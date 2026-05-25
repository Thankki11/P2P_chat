"""
peer_node.py — Peer node for the P2P Chat System.

CLI usage:
    python peer_node.py --username alice --port 6001 --bootstrap localhost:9000

Starts:
  - A TCP server thread that accepts incoming connections from other peers.
  - A heartbeat thread that pings the bootstrap server every 15s.
  - A bootstrap listener thread that receives pushed PEER_LIST / flushed messages.
Provides:
  - send_direct(to_peer_id, content)              — send a ChatMsg to a peer directly.
  - send_group(group_id, member_ids, content)     — broadcast a GroupMsg to a group.
  - get_messages(peer_id)                         — return inbox messages.
  - get_group_messages(group_id)                  — return group inbox messages.
  - get_peers()                                   — return current known peers.
"""

import argparse
import socket
import threading
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, List, Optional

from protocol import (
    PeerInfo, RegisterMsg, ChatMsg, GroupMsg,
    HeartbeatMsg, PeerHeartbeatMsg, AckMsg, StoreFwdMsg, MsgType,
    encode, decode, make_id
)
from connection_manager import ConnectionManager

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [peer] %(message)s")


class PeerNode:
    """Represents a single peer in the P2P network."""

    def __init__(self, username: str, port: int,
                 bootstrap_host: str = "localhost", bootstrap_port: int = 9000):
        self.peer_id: str = make_id()
        self.username: str = username
        self.port: int = port
        self.bootstrap_host: str = bootstrap_host
        self.bootstrap_port: int = bootstrap_port

        self.inbox: list = []
        self.known_peers: dict = {}          # {peer_id: PeerInfo}
        self.conn_manager: Optional[ConnectionManager] = None
        self.on_message_callback: Optional[Callable] = None

        self._running: bool = False
        self._bootstrap_conn: Optional[socket.socket] = None
        self._bootstrap_lock = threading.Lock()
        self._inbox_lock = threading.Lock()
        self._peers_lock = threading.Lock()
        self._server_sock: Optional[socket.socket] = None
        self._peer_hb_fail_count: dict = {}   # {peer_id: int} consecutive failures
        self._peer_hb_lock = threading.Lock()

    @property
    def info(self) -> PeerInfo:
        return PeerInfo(
            peer_id=self.peer_id,
            username=self.username,
            host="127.0.0.1",
            port=self.port,
            online=True,
            last_seen=time.time()
        )

    def start(self) -> None:
        """Connect to bootstrap, register, read initial PEER_LIST, then start threads."""
        self._running = True
        try:
            self._bootstrap_conn = socket.create_connection(
                (self.bootstrap_host, self.bootstrap_port), timeout=10
            )
            self._bootstrap_conn.settimeout(None)  # blocking mode for listener

            reg = RegisterMsg(
                peer_id=self.peer_id,
                username=self.username,
                host="127.0.0.1",
                port=self.port
            )
            with self._bootstrap_lock:
                self._bootstrap_conn.sendall(encode(reg))

            # Read initial PEER_LIST response synchronously before returning
            f = self._bootstrap_conn.makefile("r", encoding="utf-8")
            line = f.readline()
            if line.strip():
                data = decode(line)
                if data.get("type") == MsgType.PEER_LIST:
                    self._update_peers(data.get("peers", []))

            self.conn_manager = ConnectionManager(dict(self.known_peers))
        except (OSError, ConnectionRefusedError) as e:
            logger.warning(f"Could not connect to bootstrap: {e}")
            self.conn_manager = ConnectionManager({})

        threading.Thread(target=self._server_loop, daemon=True).start()
        threading.Thread(target=self._heartbeat_loop, daemon=True).start()
        threading.Thread(target=self._peer_heartbeat_loop, daemon=True).start()
        if self._bootstrap_conn:
            threading.Thread(target=self._bootstrap_listener, daemon=True).start()
        logger.info(f"PeerNode '{self.username}' started (id={self.peer_id})")

    def _server_loop(self) -> None:
        """Listen for incoming TCP connections; each client gets its own thread."""
        try:
            self._server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_sock.bind(("0.0.0.0", self.port))
            self._server_sock.listen(50)
            self._server_sock.settimeout(1.0)
            logger.info(f"Peer server listening on port {self.port}")
            while self._running:
                try:
                    conn, addr = self._server_sock.accept()
                    t = threading.Thread(
                        target=self.handle_incoming, args=(conn,), daemon=True
                    )
                    t.start()
                except socket.timeout:
                    continue
                except OSError:
                    break
        except OSError as e:
            logger.error(f"Server loop error: {e}")
        finally:
            if self._server_sock:
                try:
                    self._server_sock.close()
                except OSError:
                    pass

    def handle_incoming(self, conn: socket.socket) -> None:
        """Handle one incoming connection: read a message, ACK it, fire callback."""
        conn.settimeout(30)
        try:
            f = conn.makefile("r", encoding="utf-8")
            line = f.readline()
            if not line.strip():
                return
            data = decode(line)
            msg_type = data.get("type")

            if msg_type == MsgType.CHAT_MSG:
                try:
                    msg = ChatMsg(**data)
                except Exception as e:
                    logger.warning(f"Invalid ChatMsg: {e}")
                    return
                entry = msg.model_dump()
                entry["isMe"] = False
                with self._inbox_lock:
                    self.inbox.append(entry)
                try:
                    conn.sendall(encode(AckMsg(msg_id=msg.msg_id, status="ok")))
                except OSError as e:
                    logger.debug(f"ACK send failed: {e}")
                if self.on_message_callback:
                    try:
                        self.on_message_callback(msg.from_id, {**entry, "type": "NEW_MESSAGE"})
                    except Exception as e:
                        logger.debug(f"Callback error: {e}")

            elif msg_type == MsgType.GROUP_MSG:
                try:
                    msg = GroupMsg(**data)
                except Exception as e:
                    logger.warning(f"Invalid GroupMsg: {e}")
                    return
                entry = msg.model_dump()
                entry["isMe"] = False
                with self._inbox_lock:
                    self.inbox.append(entry)
                try:
                    conn.sendall(encode(AckMsg(msg_id=msg.msg_id, status="ok")))
                except OSError as e:
                    logger.debug(f"ACK send failed: {e}")
                if self.on_message_callback:
                    try:
                        self.on_message_callback(msg.from_id, {**entry, "type": "NEW_MESSAGE"})
                    except Exception as e:
                        logger.debug(f"Callback error: {e}")

            elif msg_type == MsgType.PEER_HEARTBEAT:
                try:
                    conn.sendall(encode(AckMsg(msg_id=data.get("from_id", "hb"), status="ok")))
                except OSError as e:
                    logger.debug(f"PEER_HEARTBEAT ACK send failed: {e}")

            elif msg_type == MsgType.PEER_LIST:
                self._update_peers(data.get("peers", []))

        except Exception as e:
            logger.debug(f"Error handling incoming connection: {e}")
        finally:
            try:
                conn.close()
            except OSError:
                pass

    def _heartbeat_loop(self) -> None:
        """Send HEARTBEAT to bootstrap every 15 seconds."""
        while self._running:
            time.sleep(15)
            if not self._bootstrap_conn:
                continue
            try:
                hb = HeartbeatMsg(peer_id=self.peer_id, timestamp=time.time())
                with self._bootstrap_lock:
                    self._bootstrap_conn.sendall(encode(hb))
            except OSError as e:
                logger.warning(f"Heartbeat failed: {e}")
                self._bootstrap_conn = None

    def _peer_heartbeat_loop(self) -> None:
        """Every 15s, ping all known online peers directly. Mark offline after 3 consecutive failures."""
        INTERVAL = 15
        MAX_FAILS = 3
        while self._running:
            time.sleep(INTERVAL)
            if not self.conn_manager:
                continue
            with self._peers_lock:
                peers_snapshot = [p for p in self.known_peers.values() if p.online]

            if not peers_snapshot:
                continue

            def ping_peer(peer: PeerInfo):
                hb = PeerHeartbeatMsg(from_id=self.peer_id, timestamp=time.time())
                try:
                    return peer, self.conn_manager.send_to(peer.peer_id, hb)
                except Exception:
                    return peer, False

            with ThreadPoolExecutor(max_workers=min(len(peers_snapshot), 10)) as executor:
                futures = {executor.submit(ping_peer, p): p for p in peers_snapshot}
                for future in as_completed(futures):
                    try:
                        peer, success = future.result()
                    except Exception:
                        peer = futures[future]
                        success = False

                    with self._peer_hb_lock:
                        if success:
                            self._peer_hb_fail_count[peer.peer_id] = 0
                            continue
                        count = self._peer_hb_fail_count.get(peer.peer_id, 0) + 1
                        self._peer_hb_fail_count[peer.peer_id] = count

                    if count >= MAX_FAILS:
                        with self._peers_lock:
                            if peer.peer_id in self.known_peers:
                                self.known_peers[peer.peer_id].online = False
                        logger.info(
                            f"Peer {peer.peer_id} ({peer.username}) marked offline "
                            f"after {MAX_FAILS} HB failures"
                        )
                        if self.on_message_callback:
                            try:
                                self.on_message_callback(peer.peer_id, {
                                    "type": "PEER_STATUS",
                                    "peer_id": peer.peer_id,
                                    "online": False,
                                    "username": peer.username,
                                    "timestamp": time.time(),
                                })
                            except Exception as e:
                                logger.debug(f"Callback error on peer offline: {e}")

    def _bootstrap_listener(self) -> None:
        """Listen for pushed messages from the bootstrap (PEER_LIST, flushed store-fwd)."""
        if not self._bootstrap_conn:
            return
        try:
            f = self._bootstrap_conn.makefile("r", encoding="utf-8")
            while self._running:
                try:
                    line = f.readline()
                    if not line:
                        break
                    line = line.strip()
                    if not line:
                        continue
                    data = decode(line)
                    msg_type = data.get("type")

                    if msg_type == MsgType.PEER_LIST:
                        self._update_peers(data.get("peers", []))
                    elif msg_type in (MsgType.CHAT_MSG, MsgType.GROUP_MSG):
                        entry = data.copy()
                        entry["isMe"] = False
                        with self._inbox_lock:
                            self.inbox.append(entry)
                        if self.on_message_callback:
                            try:
                                self.on_message_callback(
                                    data.get("from_id", ""),
                                    {**entry, "type": "STORE_FWD_RECV"}
                                )
                            except Exception as e:
                                logger.debug(f"Callback error: {e}")
                except socket.timeout:
                    continue
        except OSError as e:
            logger.info(f"Bootstrap listener closed: {e}")

    def _update_peers(self, peers_data: list) -> None:
        """Replace known_peers from a list of dicts or PeerInfo objects."""
        try:
            new_peers = {}
            for p in peers_data:
                if isinstance(p, dict):
                    try:
                        info = PeerInfo(**p)
                        if info.peer_id != self.peer_id:
                            new_peers[info.peer_id] = info
                    except Exception as e:
                        logger.debug(f"Invalid PeerInfo dict: {e}")
                elif isinstance(p, PeerInfo):
                    if p.peer_id != self.peer_id:
                        new_peers[p.peer_id] = p
            with self._peers_lock:
                self.known_peers = new_peers
            if self.conn_manager:
                online_only = [p for p in new_peers.values() if p.online]
                self.conn_manager.update_peers(online_only)

            # Reconcile: if bootstrap says a peer is online but we had marked them offline,
            # reset fail count and notify frontend they are back online.
            with self._peer_hb_lock:
                for pid, info in new_peers.items():
                    if info.online and self._peer_hb_fail_count.get(pid, 0) >= 3:
                        self._peer_hb_fail_count[pid] = 0
                        if self.on_message_callback:
                            try:
                                self.on_message_callback(pid, {
                                    "type": "PEER_STATUS",
                                    "peer_id": pid,
                                    "online": True,
                                    "username": info.username,
                                    "timestamp": time.time(),
                                })
                            except Exception as e:
                                logger.debug(f"Callback error on peer online reconcile: {e}")
        except Exception as e:
            logger.error(f"_update_peers error: {e}")

    def _send_to_bootstrap(self, msg) -> bool:
        """Thread-safe send to bootstrap connection."""
        if not self._bootstrap_conn:
            return False
        try:
            with self._bootstrap_lock:
                self._bootstrap_conn.sendall(encode(msg))
            return True
        except OSError as e:
            logger.warning(f"Failed to send to bootstrap: {e}")
            self._bootstrap_conn = None
            return False

    def send_direct(self, to_peer_id: str, content: str) -> dict:
        """Send a ChatMsg to to_peer_id. Falls back to store-and-forward if unreachable."""
        msg_id = make_id()
        now = time.time()
        msg = ChatMsg(
            msg_id=msg_id,
            from_id=self.peer_id,
            from_username=self.username,
            to_id=to_peer_id,
            content=content,
            timestamp=now,
            delivered=False
        )

        delivered = False
        status = "queued"
        if self.conn_manager:
            try:
                delivered = self.conn_manager.send_to(to_peer_id, msg)
            except Exception as e:
                logger.debug(f"send_direct conn_manager error: {e}")

        if delivered:
            msg.delivered = True
            status = "ok"

        entry = msg.model_dump()
        entry["isMe"] = True
        with self._inbox_lock:
            self.inbox.append(entry)

        if not delivered:
            sfwd = StoreFwdMsg(
                msg_id=msg_id,
                target_id=to_peer_id,
                payload=msg.model_dump()
            )
            self._send_to_bootstrap(sfwd)

        return {
            "msg_id": msg_id,
            "status": status,
            "delivered": delivered,
            "timestamp": now
        }

    def send_group(self, group_id: str, member_ids: List[str], content: str) -> dict:
        """Broadcast a GroupMsg to all member_ids. Queues failures via store-and-forward."""
        msg_id = make_id()
        now = time.time()
        msg = GroupMsg(
            msg_id=msg_id,
            from_id=self.peer_id,
            from_username=self.username,
            group_id=group_id,
            member_ids=member_ids,
            content=content,
            timestamp=now
        )

        entry = msg.model_dump()
        entry["isMe"] = True
        with self._inbox_lock:
            self.inbox.append(entry)

        sent_to, queued_for, failed = [], [], []
        if self.conn_manager:
            try:
                results = self.conn_manager.broadcast(
                    [pid for pid in member_ids if pid != self.peer_id], msg
                )
                for pid, ok in results.items():
                    if ok:
                        sent_to.append(pid)
                    else:
                        sfwd = StoreFwdMsg(
                            msg_id=make_id(),
                            target_id=pid,
                            payload=msg.model_dump()
                        )
                        if self._send_to_bootstrap(sfwd):
                            queued_for.append(pid)
                        else:
                            failed.append(pid)
            except Exception as e:
                logger.error(f"send_group broadcast error: {e}")

        return {
            "msg_id": msg_id,
            "timestamp": now,
            "sent_to": sent_to,
            "queued_for": queued_for,
            "failed": failed
        }

    def get_messages(self, peer_id: str = None) -> list:
        """Return one-to-one inbox messages, optionally filtered by peer_id."""
        try:
            with self._inbox_lock:
                msgs = [m for m in self.inbox if not m.get("group_id")]
            if peer_id:
                return [
                    m for m in msgs
                    if m.get("from_id") == peer_id or m.get("to_id") == peer_id
                ]
            return msgs
        except Exception as e:
            logger.error(f"get_messages error: {e}")
            return []

    def get_group_messages(self, group_id: str) -> list:
        """Return inbox messages belonging to group_id."""
        try:
            with self._inbox_lock:
                msgs = list(self.inbox)
            return [m for m in msgs if m.get("group_id") == group_id]
        except Exception as e:
            logger.error(f"get_group_messages error: {e}")
            return []

    def get_peers(self) -> list:
        """Return current list of known PeerInfo objects."""
        try:
            with self._peers_lock:
                return list(self.known_peers.values())
        except Exception as e:
            logger.error(f"get_peers error: {e}")
            return []

    def stop(self) -> None:
        """Signal all background threads to stop and close sockets."""
        self._running = False
        if self._bootstrap_conn:
            try:
                self._bootstrap_conn.close()
            except OSError:
                pass
        if self._server_sock:
            try:
                self._server_sock.close()
            except OSError:
                pass
        logger.info(f"PeerNode '{self.username}' stopped")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="P2P Chat Peer Node")
    parser.add_argument("--username", required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--bootstrap", default="localhost:9000")
    args = parser.parse_args()
    bhost, bport = args.bootstrap.split(":")
    node = PeerNode(args.username, args.port, bhost, int(bport))
    node.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        node.stop()
