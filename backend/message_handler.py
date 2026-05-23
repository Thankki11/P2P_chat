"""
message_handler.py — Store-and-forward queue for offline peer delivery.

When a target peer is unreachable, messages are queued here with a TTL.
When the peer reconnects, flush_queue() delivers queued messages.
cleanup_expired() removes messages that have passed their TTL.
"""

import threading
import time
import logging
from collections import defaultdict
from typing import List

logger = logging.getLogger(__name__)


class MessageHandler:
    """Manages the offline message queue (store-and-forward)."""

    def __init__(self):
        self.store: dict = defaultdict(list)  # {target_id: [{"msg": dict, "expire_at": float}]}
        self._lock = threading.Lock()

    def queue_message(self, target_id: str, msg: dict) -> None:
        """Queue a message for delivery when the target peer comes online."""
        try:
            expire_at = time.time() + 86400  # 24 hours TTL
            with self._lock:
                self.store[target_id].append({"msg": msg, "expire_at": expire_at})
            logger.debug(f"Queued message for {target_id}")
        except Exception as e:
            logger.error(f"Failed to queue message for {target_id}: {e}")

    def flush_queue(self, peer_id: str) -> List[dict]:
        """Return and remove all non-expired messages for peer_id."""
        try:
            now = time.time()
            with self._lock:
                entries = self.store.pop(peer_id, [])
            valid = [e["msg"] for e in entries if e["expire_at"] > now]
            logger.debug(f"Flushed {len(valid)} messages for {peer_id}")
            return valid
        except Exception as e:
            logger.error(f"Failed to flush queue for {peer_id}: {e}")
            return []

    def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count of removed entries."""
        try:
            now = time.time()
            count = 0
            with self._lock:
                for peer_id in list(self.store.keys()):
                    before = len(self.store[peer_id])
                    self.store[peer_id] = [
                        e for e in self.store[peer_id] if e["expire_at"] > now
                    ]
                    count += before - len(self.store[peer_id])
                    if not self.store[peer_id]:
                        del self.store[peer_id]
            if count:
                logger.info(f"Cleaned up {count} expired queued messages")
            return count
        except Exception as e:
            logger.error(f"Failed during cleanup_expired: {e}")
            return 0

    def queue_size(self, peer_id: str) -> int:
        """Return the number of queued messages for peer_id."""
        try:
            with self._lock:
                return len(self.store.get(peer_id, []))
        except Exception as e:
            logger.error(f"Failed to get queue size for {peer_id}: {e}")
            return 0
