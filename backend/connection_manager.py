"""
connection_manager.py — Manages outgoing TCP connections to remote peers.

Provides send_to() for unicast and broadcast() for multicast delivery.
Retries failed connections up to 3 times before giving up.
"""

import socket
import time
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List

from pydantic import BaseModel
from protocol import PeerInfo, encode

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Handles opening TCP connections to peers and delivering encoded messages."""

    def __init__(self, known_peers: dict):
        self.known_peers = known_peers  # {peer_id: PeerInfo}
        self._lock = threading.Lock()

    def send_to(self, peer_id: str, msg: BaseModel) -> bool:
        """Encode msg and deliver it to the peer identified by peer_id.

        Returns True on success, False if all retries are exhausted.
        """
        try:
            with self._lock:
                peer = self.known_peers.get(peer_id)
            if not peer:
                logger.debug(f"Unknown peer_id: {peer_id}")
                return False
            return self._try_connect(peer.host, peer.port, encode(msg))
        except Exception as e:
            logger.error(f"send_to({peer_id}) unexpected error: {e}")
            return False

    def broadcast(self, peer_ids: List[str], msg: BaseModel) -> dict:
        """Send msg to every peer_id in the list concurrently.

        Returns a dict mapping peer_id -> bool (delivery success).
        """
        results = {}
        try:
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = {
                    executor.submit(self.send_to, pid, msg): pid
                    for pid in peer_ids
                }
                for future in as_completed(futures):
                    pid = futures[future]
                    try:
                        results[pid] = future.result()
                    except Exception as e:
                        logger.debug(f"broadcast future error for {pid}: {e}")
                        results[pid] = False
        except Exception as e:
            logger.error(f"broadcast unexpected error: {e}")
        return results

    def _try_connect(self, host: str, port: int, data: bytes,
                     retries: int = 3, timeout: int = 5) -> bool:
        """Try to open a TCP connection and send data, with retries.

        Returns True if data was sent and an ACK line was received.
        """
        for attempt in range(retries):
            try:
                s = socket.create_connection((host, port), timeout=timeout)
                s.sendall(data)
                s.settimeout(5)
                ack_raw = s.makefile().readline()
                s.close()
                return bool(ack_raw)
            except (ConnectionRefusedError, TimeoutError, OSError) as e:
                logger.debug(f"Attempt {attempt + 1}/{retries} to {host}:{port} failed: {e}")
                if attempt < retries - 1:
                    time.sleep(1)
        return False

    def update_peers(self, peers: List[PeerInfo]) -> None:
        """Replace the known_peers dict with a fresh list."""
        try:
            with self._lock:
                self.known_peers = {p.peer_id: p for p in peers}
        except Exception as e:
            logger.error(f"update_peers error: {e}")
