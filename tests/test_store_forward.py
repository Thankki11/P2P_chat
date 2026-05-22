"""
test_store_forward.py — Tests for the store-and-forward offline queue.

Tests:
  - Message to an offline peer is queued (not dropped).
  - Queue is flushed when the peer reconnects.
  - Expired messages are removed by cleanup_expired().
"""

import pytest
import time
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from protocol import ChatMsg, StoreFwdMsg


@pytest.fixture
def handler():
    """Return a fresh MessageHandler instance with a short TTL for testing."""
    # TODO: from message_handler import MessageHandler; return MessageHandler(ttl=2)
    return None


class TestOfflineQueue:
    def test_message_queued_for_offline_peer(self, handler):
        """queue_message() should store a StoreFwdMsg for the recipient."""
        # TODO:
        #   1. msg = ChatMsg(sender="alice", recipient="bob", content="hi")
        #   2. sfwd = handler.queue_message("bob", msg)
        #   3. assert isinstance(sfwd, StoreFwdMsg)
        #   4. assert handler.queue_size("bob") == 1
        pass

    def test_flush_delivers_queued_messages(self, handler):
        """flush_queue() should call send_fn for each queued message."""
        delivered = []

        def mock_send(msg):
            delivered.append(msg)
            return True

        # TODO:
        #   1. Queue two messages for "bob"
        #   2. handler.flush_queue("bob", mock_send)
        #   3. assert len(delivered) == 2
        #   4. assert handler.queue_size("bob") == 0
        pass

    def test_expired_messages_cleaned_up(self, handler):
        """cleanup_expired() should remove messages past their TTL."""
        # TODO:
        #   1. Queue a message (TTL=2s from fixture)
        #   2. time.sleep(3)
        #   3. removed = handler.cleanup_expired()
        #   4. assert removed >= 1
        #   5. assert handler.queue_size("bob") == 0
        pass

    def test_flush_on_reconnect_clears_queue(self, handler):
        """After flush, queue should be empty."""
        # TODO: queue then flush, assert queue_size == 0
        pass
