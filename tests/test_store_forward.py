import sys, os, time, threading
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import pytest
from message_handler import MessageHandler


@pytest.fixture
def handler():
    return MessageHandler()


def test_queue_message_stores(handler):
    handler.queue_message("bob", {"content": "hi", "type": "CHAT_MSG"})
    assert handler.queue_size("bob") == 1


def test_flush_returns_messages(handler):
    handler.queue_message("bob", {"content": "hi"})
    handler.queue_message("bob", {"content": "there"})
    msgs = handler.flush_queue("bob")
    assert len(msgs) == 2
    assert any(m["content"] == "hi" for m in msgs)


def test_flush_clears_queue(handler):
    handler.queue_message("bob", {"content": "hi"})
    handler.flush_queue("bob")
    assert handler.queue_size("bob") == 0


def test_flush_empty_returns_empty(handler):
    result = handler.flush_queue("nobody")
    assert result == []


def test_flush_second_time_returns_empty(handler):
    handler.queue_message("bob", {"content": "hi"})
    handler.flush_queue("bob")
    result = handler.flush_queue("bob")
    assert result == []


def test_expired_message_skipped_on_flush(handler):
    # Manually insert an expired entry
    handler.store["bob"].append({"msg": {"content": "expired"}, "expire_at": time.time() - 1})
    msgs = handler.flush_queue("bob")
    assert len(msgs) == 0


def test_cleanup_removes_expired(handler):
    handler.store["bob"].append({"msg": {"content": "old"}, "expire_at": time.time() - 1})
    handler.store["alice"].append({"msg": {"content": "fresh"}, "expire_at": time.time() + 3600})
    removed = handler.cleanup_expired()
    assert removed == 1
    assert handler.queue_size("bob") == 0
    assert handler.queue_size("alice") == 1


def test_queue_size_zero_for_unknown(handler):
    assert handler.queue_size("nonexistent") == 0


def test_concurrent_queue(handler):
    def enqueue():
        for _ in range(50):
            handler.queue_message("bob", {"content": "x"})

    threads = [threading.Thread(target=enqueue) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert handler.queue_size("bob") == 200
