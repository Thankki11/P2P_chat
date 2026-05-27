"""
bootstrap_server.py — TCP bootstrap server for peer discovery.

Listens on port 9000. Peers connect, send REGISTER, receive PEER_LIST.
Supports HEARTBEAT to keep peers alive and STORE_FWD to queue messages.
A background thread evicts peers that miss heartbeats for longer than
HEARTBEAT_TIMEOUT seconds.
"""

import socket
import threading
import time
import json
import logging
from typing import Optional

from protocol import (
    PeerInfo, PeerListMsg,
    AckMsg, MsgType, encode, decode, make_id
)
from message_handler import MessageHandler

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [bootstrap] %(message)s")


class BootstrapServer:
    HEARTBEAT_TIMEOUT = 45

    def __init__(self):
        self.registry: dict = {}       # {peer_id: PeerInfo}
        self.last_seen: dict = {}      # {peer_id: float}
        self.connections: dict = {}    # {peer_id: socket}
        self.message_handler: Optional[MessageHandler] = None
        self._lock = threading.Lock()
        self._running = False

    def start(self, host: str = "0.0.0.0", port: int = 9000) -> None:
        """Bind the TCP socket, start the cleanup thread, and accept connections."""
        self._running = True
        cleanup = threading.Thread(target=self._cleanup_loop, daemon=True)
        cleanup.start()

        try:
            server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server_sock.bind((host, port))
            server_sock.listen(50)
            server_sock.settimeout(1.0)
            logger.info(f"Bootstrap listening on {host}:{port}")
            while self._running:
                try:
                    conn, addr = server_sock.accept()
                    t = threading.Thread(
                        target=self.handle_client, args=(conn, addr), daemon=True
                    )
                    t.start()
                except socket.timeout:
                    continue
                except OSError:
                    break
        except OSError as e:
            logger.error(f"Bootstrap server socket error: {e}")
        finally:
            try:
                server_sock.close()
            except OSError:
                pass

    def handle_client(self, conn: socket.socket, addr: tuple) -> None:
        """Handle a single client connection — loops reading lines until closed."""
        conn.settimeout(60)
        f = conn.makefile("r", encoding="utf-8")
        registered_id = None
        try:
            while self._running:
                try:
                    line = f.readline()
                except socket.timeout:
                    continue
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    data = decode(line)
                    msg_type = data.get("type")
                    if msg_type == MsgType.REGISTER:
                        registered_id = data.get("peer_id")
                        self._handle_register(conn, data)
                    elif msg_type == MsgType.HEARTBEAT:
                        self._handle_heartbeat(data)
                    elif msg_type == MsgType.STORE_FWD:
                        self._handle_store_fwd(conn, data)
                    elif msg_type == MsgType.STATUS_UPDATE:
                        self._handle_status_update(conn, data)
                    else:
                        logger.warning(f"Unknown message type '{msg_type}' from {addr}")
                except Exception as e:
                    logger.warning(f"Error handling message from {addr}: {e}")
        except (OSError, socket.timeout) as e:
            logger.debug(f"Connection from {addr} closed: {e}")
        finally:
            if registered_id:
                with self._lock:
                    self.connections.pop(registered_id, None)
                    if registered_id in self.registry:
                        self.registry[registered_id].online = False
                logger.info(f"Peer {registered_id} disconnected")
                self.broadcast_peer_list()
            try:
                conn.close()
            except OSError:
                pass

    def _handle_register(self, conn: socket.socket, data: dict) -> None:
        """Upsert registry, send PeerListMsg back, broadcast updated list, flush queued msgs."""
        try:
            peer_id = data["peer_id"]
            peer = PeerInfo(
                peer_id=peer_id,
                username=data["username"],
                host=data["host"],
                port=data["port"],
                online=True,
                last_seen=time.time(),
                public_key=data.get("public_key", ""),
            )
            with self._lock:
                self.registry[peer_id] = peer
                self.last_seen[peer_id] = time.time()
                self.connections[peer_id] = conn

            # Send current peer list to the newly registered peer.
            # Include offline peers too so they show as gray dots in the UI.
            peers = self.get_all_peers(exclude=peer_id)
            try:
                conn.sendall(encode(PeerListMsg(peers=peers)))
            except OSError as e:
                logger.error(f"Failed to send peer list to {peer_id}: {e}")
                return

            # Flush any queued store-and-forward messages for this peer
            if self.message_handler:
                queued = self.message_handler.flush_queue(peer_id)
                for msg_dict in queued:
                    try:
                        conn.sendall((json.dumps(msg_dict) + "\n").encode("utf-8"))
                    except OSError:
                        logger.debug(f"Failed to flush queued message to {peer_id}")
                        break

            # Broadcast updated list to all other connected peers
            self.broadcast_peer_list(exclude=peer_id)
            logger.info(f"Registered peer: {data['username']} ({peer_id})")
        except KeyError as e:
            logger.warning(f"REGISTER missing field: {e}")
        except Exception as e:
            logger.error(f"_handle_register error: {e}")

    def _handle_heartbeat(self, data: dict) -> None:
        """Update last_seen timestamp for the heartbeating peer."""
        try:
            peer_id = data.get("peer_id")
            if not peer_id:
                return
            with self._lock:
                self.last_seen[peer_id] = time.time()
                if peer_id in self.registry:
                    self.registry[peer_id].last_seen = time.time()
                    self.registry[peer_id].online = True
        except Exception as e:
            logger.error(f"_handle_heartbeat error: {e}")

    def _handle_status_update(self, conn: socket.socket, data: dict) -> None:
        """Handle explicit presence toggle (Tàng hình). Updates registry + broadcasts.
        When going back online, flush any queued store-and-forward messages."""
        try:
            peer_id = data.get("peer_id")
            online = bool(data.get("online", True))
            if not peer_id:
                return
            changed = False
            with self._lock:
                if peer_id in self.registry:
                    if self.registry[peer_id].online != online:
                        self.registry[peer_id].online = online
                        changed = True
                    if online:
                        # Reset timestamp so the cleanup thread doesn't immediately re-offline
                        self.last_seen[peer_id] = time.time()
                        self.registry[peer_id].last_seen = time.time()

            # Flush queued messages when returning online
            if online and self.message_handler:
                queued = self.message_handler.flush_queue(peer_id)
                for msg_dict in queued:
                    try:
                        conn.sendall((json.dumps(msg_dict) + "\n").encode("utf-8"))
                    except OSError:
                        logger.debug(f"Flush failed for {peer_id}")
                        break

            if changed:
                self.broadcast_peer_list()
                logger.info(f"Peer {peer_id} presence → {'online' if online else 'offline (invisible)'}")
        except Exception as e:
            logger.error(f"_handle_status_update error: {e}")

    def _handle_store_fwd(self, conn: socket.socket, data: dict) -> None:
        """Queue a store-and-forward message and ACK the sender."""
        try:
            target_id = data.get("target_id")
            payload = data.get("payload", {})
            msg_id = data.get("msg_id", make_id())
            if self.message_handler and target_id:
                self.message_handler.queue_message(target_id, payload)
            ack = AckMsg(msg_id=msg_id, status="queued")
            try:
                conn.sendall(encode(ack))
            except OSError as e:
                logger.debug(f"Failed to send STORE_FWD ACK: {e}")
        except Exception as e:
            logger.error(f"_handle_store_fwd error: {e}")

    def _cleanup_loop_once(self) -> None:
        """Single cleanup pass — mark peers offline if last_seen > HEARTBEAT_TIMEOUT."""
        try:
            now = time.time()
            changed = False
            with self._lock:
                for peer_id, last in list(self.last_seen.items()):
                    if now - last > self.HEARTBEAT_TIMEOUT:
                        if peer_id in self.registry and self.registry[peer_id].online:
                            self.registry[peer_id].online = False
                            changed = True
                            logger.info(f"Peer {peer_id} timed out (no heartbeat)")
            if changed:
                self.broadcast_peer_list()
        except Exception as e:
            logger.error(f"_cleanup_loop_once error: {e}")

    def _cleanup_loop(self) -> None:
        """Every 30s, mark peers offline if last_seen > HEARTBEAT_TIMEOUT."""
        while self._running:
            time.sleep(30)
            self._cleanup_loop_once()

    def get_online_peers(self, exclude: str = None) -> list:
        """Return list of all online PeerInfo objects, optionally excluding one."""
        try:
            with self._lock:
                return [
                    p for pid, p in self.registry.items()
                    if pid != exclude and p.online
                ]
        except Exception as e:
            logger.error(f"get_online_peers error: {e}")
            return []

    def get_all_peers(self, exclude: str = None) -> list:
        """Return all known PeerInfo objects (online + offline) for UI display.
        Offline peers keep showing in the sidebar as gray dots."""
        try:
            with self._lock:
                return [p for pid, p in self.registry.items() if pid != exclude]
        except Exception as e:
            logger.error(f"get_all_peers error: {e}")
            return []

    def broadcast_peer_list(self, exclude: str = None) -> None:
        """Send updated peer list to all connected peers. Silently remove dead connections.
        Broadcasts ALL peers (online + offline) so offline peers show as gray dots in UI."""
        try:
            peers = self.get_all_peers()
            with self._lock:
                conns = dict(self.connections)
            dead = []
            for pid, conn in conns.items():
                if pid == exclude:
                    continue
                peers_for_peer = [p for p in peers if p.peer_id != pid]
                try:
                    conn.sendall(encode(PeerListMsg(peers=peers_for_peer)))
                except OSError:
                    logger.debug(f"Dead connection for {pid}, removing")
                    dead.append(pid)
            if dead:
                with self._lock:
                    for pid in dead:
                        self.connections.pop(pid, None)
        except Exception as e:
            logger.error(f"broadcast_peer_list error: {e}")


if __name__ == "__main__":
    server = BootstrapServer()
    server.message_handler = MessageHandler()
    server.start()
