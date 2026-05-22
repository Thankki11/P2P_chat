"""
bootstrap_server.py — TCP bootstrap server for peer discovery.

Listens on port 9000. Peers connect, send a REGISTER message, and receive
a PEER_LIST in response. A background thread evicts peers that miss
heartbeats for longer than HEARTBEAT_TIMEOUT seconds.
"""

import socket
import threading
import time
import logging
from typing import Dict, Tuple

from protocol import (
    PeerInfo, RegisterMsg, PeerListMsg, HeartbeatMsg, MsgType,
    encode, decode
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [bootstrap] %(message)s")
logger = logging.getLogger(__name__)

HOST = "0.0.0.0"
PORT = 9000
HEARTBEAT_TIMEOUT = 30  # seconds before a peer is considered dead

# peer registry: username → (PeerInfo, last_seen_timestamp)
peer_registry: Dict[str, Tuple[PeerInfo, float]] = {}
registry_lock = threading.Lock()


def handle_client(conn: socket.socket, addr: tuple) -> None:
    """Handle a single client connection in its own thread.

    Reads messages from the client and dispatches:
    - REGISTER  → record peer, reply with PEER_LIST
    - HEARTBEAT → refresh last-seen timestamp
    Any other message type is ignored with a warning log.
    """
    # TODO: implement full message loop (read lines, decode, dispatch)
    pass


def heartbeat_cleanup() -> None:
    """Background thread that periodically removes stale peers.

    Runs every HEARTBEAT_TIMEOUT/2 seconds, evicts any peer whose
    last_seen timestamp is older than HEARTBEAT_TIMEOUT.
    """
    # TODO: implement cleanup loop
    pass


def start_server() -> None:
    """Bind the TCP socket, start the cleanup thread, and accept connections."""
    cleanup_thread = threading.Thread(target=heartbeat_cleanup, daemon=True)
    cleanup_thread.start()
    logger.info(f"Bootstrap server listening on {HOST}:{PORT}")

    # TODO: create server socket, accept loop, spawn handle_client threads
    pass


if __name__ == "__main__":
    start_server()
