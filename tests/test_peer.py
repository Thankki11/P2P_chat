import sys, os, time, threading
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import pytest
from bootstrap_server import BootstrapServer
from message_handler import MessageHandler
from peer_node import PeerNode

BPORT = 19200
ALICE_PORT = 17101
BOB_PORT = 17102
CHARLIE_PORT = 17103


@pytest.fixture(scope="module")
def bootstrap():
    server = BootstrapServer()
    server.message_handler = MessageHandler()
    t = threading.Thread(
        target=server.start,
        kwargs={"host": "127.0.0.1", "port": BPORT},
        daemon=True
    )
    t.start()
    time.sleep(0.3)
    yield server


@pytest.fixture(scope="module")
def alice(bootstrap):
    node = PeerNode("alice", ALICE_PORT, "127.0.0.1", BPORT)
    node.start()
    time.sleep(0.5)
    yield node
    node.stop()


@pytest.fixture(scope="module")
def bob(bootstrap, alice):
    node = PeerNode("bob", BOB_PORT, "127.0.0.1", BPORT)
    node.start()
    time.sleep(0.8)  # wait for alice's peer list to update
    yield node
    node.stop()


def test_alice_knows_bob(alice, bob):
    time.sleep(0.5)
    peer_ids = [p.peer_id for p in alice.get_peers()]
    assert bob.peer_id in peer_ids


def test_alice_sends_to_bob(alice, bob):
    time.sleep(0.3)
    result = alice.send_direct(bob.peer_id, "hello from alice")
    assert result["msg_id"] is not None
    time.sleep(0.5)
    messages = bob.get_messages()
    contents = [m.get("content") for m in messages]
    assert "hello from alice" in contents


def test_bob_replies_to_alice(alice, bob):
    result = bob.send_direct(alice.peer_id, "hi alice!")
    assert result["status"] in ("ok", "queued")
    time.sleep(0.5)
    messages = alice.get_messages()
    contents = [m.get("content") for m in messages]
    assert "hi alice!" in contents


def test_group_broadcast(bootstrap, alice, bob):
    charlie = PeerNode("charlie", CHARLIE_PORT, "127.0.0.1", BPORT)
    charlie.start()
    time.sleep(1.0)

    result = alice.send_group("g1", [bob.peer_id, charlie.peer_id], "group hello")
    assert result["msg_id"] is not None
    time.sleep(0.5)

    bob_msgs = bob.get_group_messages("g1")
    assert any(m.get("content") == "group hello" for m in bob_msgs)
    charlie.stop()


def test_send_to_unknown_peer_queues(alice):
    result = alice.send_direct("nonexistent-peer-id", "will queue")
    assert result["msg_id"] is not None
    assert result["status"] in ("ok", "queued")
