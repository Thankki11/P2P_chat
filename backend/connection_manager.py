"""
connection_manager.py — Manages outgoing TCP connections to remote peers.

Provides send_to() for unicast and broadcast() for multicast delivery.
Retries failed connections up to MAX_RETRIES times before giving up.
"""

import socket
import time
import logging
from typing import List

from protocol import PeerInfo, BaseModel, encode

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_DELAY = 1.0  # seconds between retries


class ConnectionManager:
    """Handles opening, caching, and retrying TCP connections to peers."""

    def __init__(self):
        """Initialise an empty connection cache."""
        # TODO: set up a dict to cache open sockets keyed by peer address
        pass

    def send_to(self, peer: PeerInfo, msg: BaseModel) -> bool:
        """Encode msg and deliver it to a single peer over TCP.

        Retries up to MAX_RETRIES times on failure.
        Returns True on success, False if all retries are exhausted.
        """
        # TODO: call _try_connect, send encode(msg), handle exceptions
        pass

    def broadcast(self, peers: List[PeerInfo], msg: BaseModel) -> dict:
        """Send msg to every peer in the list.

        Returns a dict mapping peer.username → bool (delivery success).
        """
        # TODO: iterate peers, call send_to for each, collect results
        pass

    def _try_connect(self, peer: PeerInfo) -> socket.socket:
        """Attempt to open (or reuse) a TCP connection to peer.

        Raises ConnectionRefusedError after MAX_RETRIES failed attempts.
        """
        # TODO: check cache, try socket.connect with retry loop
        pass

    def close_all(self) -> None:
        """Close all cached connections (called on shutdown)."""
        # TODO: iterate cached sockets and close each
        pass
