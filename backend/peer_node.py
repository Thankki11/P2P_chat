"""
peer_node.py — Peer node entry point for the P2P Chat System.

CLI usage:
    python peer_node.py --username alice --port 6001 --bootstrap localhost:9000

Starts:
  - A TCP server thread that accepts incoming connections from other peers.
  - A heartbeat thread that pings the bootstrap server every HEARTBEAT_INTERVAL s.
Provides:
  - send_direct(recipient_info, msg) — send a ChatMsg to a peer directly.
  - get_messages()                   — return queued incoming messages.
"""

import argparse
import socket
import threading
import time
import logging
from typing import List

from protocol import (
    PeerInfo, RegisterMsg, HeartbeatMsg, ChatMsg,
    encode, decode
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [peer] %(message)s")
logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL = 10  # seconds


class PeerNode:
    """Represents a single peer in the P2P network."""

    def __init__(self, username: str, port: int, bootstrap_host: str, bootstrap_port: int):
        """Initialise peer state: own PeerInfo, empty message inbox, stop event."""
        self.info = PeerInfo(username=username, host="127.0.0.1", port=port)
        self.bootstrap = (bootstrap_host, bootstrap_port)
        self.inbox: List[ChatMsg] = []
        self._stop_event = threading.Event()
        # TODO: initialise connection manager and message handler

    def register_with_bootstrap(self) -> List[PeerInfo]:
        """Connect to the bootstrap server, send REGISTER, return received PEER_LIST."""
        # TODO: open TCP connection, encode RegisterMsg, read PeerListMsg response
        pass

    def _server_thread(self) -> None:
        """Listen for incoming TCP connections from other peers.

        On each connection, read the ChatMsg/GroupMsg and append to self.inbox.
        """
        # TODO: bind self.info.port, accept loop, decode message, append inbox
        pass

    def _heartbeat_thread(self) -> None:
        """Send HeartbeatMsg to the bootstrap server every HEARTBEAT_INTERVAL seconds."""
        # TODO: loop until _stop_event, send HeartbeatMsg, sleep
        pass

    def send_direct(self, recipient: PeerInfo, content: str) -> bool:
        """Open a TCP connection to recipient and send a ChatMsg.

        Returns True on success, False on failure (peer offline).
        """
        # TODO: build ChatMsg, encode, connect to recipient.host:port, send
        pass

    def get_messages(self) -> List[ChatMsg]:
        """Return and clear all messages currently in the inbox."""
        # TODO: thread-safe pop of self.inbox
        pass

    def start(self) -> None:
        """Start server and heartbeat background threads."""
        threading.Thread(target=self._server_thread, daemon=True).start()
        threading.Thread(target=self._heartbeat_thread, daemon=True).start()
        logger.info(f"Peer '{self.info.username}' started on port {self.info.port}")

    def stop(self) -> None:
        """Signal background threads to stop."""
        self._stop_event.set()


def parse_args() -> argparse.Namespace:
    """Parse CLI arguments: --username, --port, --bootstrap."""
    parser = argparse.ArgumentParser(description="P2P Chat Peer Node")
    parser.add_argument("--username", required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--bootstrap", default="localhost:9000",
                        help="bootstrap host:port (default localhost:9000)")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    bhost, bport = args.bootstrap.split(":")
    node = PeerNode(args.username, args.port, bhost, int(bport))
    peers = node.register_with_bootstrap()
    logger.info(f"Known peers: {[p.username for p in peers]}")
    node.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        node.stop()
