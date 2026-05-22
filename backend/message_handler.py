"""
message_handler.py — Store-and-forward queue for offline peer delivery.

When a target peer is unreachable, messages are queued here with a TTL.
When the peer reconnects, flush_queue() delivers queued messages.
cleanup_expired() removes messages that have passed their TTL.
"""

import logging
import time
from collections import defaultdict
from typing import List

from protocol import ChatMsg, GroupMsg, StoreFwdMsg, encode

logger = logging.getLogger(__name__)

DEFAULT_TTL = 3600  # seconds before a queued message expires


class MessageHandler:
    """Manages the offline message queue (store-and-forward)."""

    def __init__(self, ttl: int = DEFAULT_TTL):
        """Initialise an empty queue dict and set TTL."""
        # TODO: queue: dict[username, list[StoreFwdMsg]]
        self.ttl = ttl

    def queue_message(self, recipient: str, msg: ChatMsg | GroupMsg) -> StoreFwdMsg:
        """Wrap msg in a StoreFwdMsg and add it to the recipient's queue.

        Sets expires_at = now + ttl.
        Returns the created StoreFwdMsg.
        """
        # TODO: build StoreFwdMsg, append to queue[recipient]
        pass

    def flush_queue(self, recipient: str, send_fn) -> int:
        """Deliver all queued messages for recipient by calling send_fn(msg).

        Removes successfully delivered messages from the queue.
        Returns the number of messages delivered.
        """
        # TODO: iterate queue[recipient], call send_fn, remove on success
        pass

    def cleanup_expired(self) -> int:
        """Scan all queues and remove messages whose expires_at has passed.

        Returns the total number of messages removed.
        """
        # TODO: parse expires_at, compare to now, remove expired entries
        pass

    def queue_size(self, recipient: str) -> int:
        """Return the current number of queued messages for recipient."""
        # TODO: return len(queue[recipient])
        pass
