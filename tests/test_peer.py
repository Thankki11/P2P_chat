"""
test_peer.py — Integration tests for direct P2P messaging.

Tests:
  - Two PeerNode instances can exchange a 1-to-1 ChatMsg.
  - GroupMsg is broadcast to all members.
"""

import pytest
import time
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from protocol import ChatMsg, GroupMsg


@pytest.fixture
def two_peers():
    """Start two PeerNode instances connected to each other.

    TODO:
      - Start a test bootstrap server.
      - Create PeerNode("alice", port=16001) and PeerNode("bob", port=16002).
      - Register both and let them discover each other.
      - Yield (alice_node, bob_node).
      - Stop both nodes after the test.
    """
    # TODO: implement fixture
    yield None, None


class TestDirectMessage:
    def test_alice_sends_to_bob(self, two_peers):
        """Alice sends a ChatMsg; Bob's inbox should contain it within 2 s."""
        alice, bob = two_peers
        # TODO:
        #   1. alice.send_direct(bob.info, "hello bob")
        #   2. time.sleep(0.5)
        #   3. messages = bob.get_messages()
        #   4. assert any(m.content == "hello bob" for m in messages)
        pass

    def test_reply_from_bob_to_alice(self, two_peers):
        """Bob can reply to Alice after receiving her message."""
        alice, bob = two_peers
        # TODO: similar to above but in reverse
        pass


class TestGroupBroadcast:
    def test_group_message_reaches_all_members(self, two_peers):
        """GroupMsg sent by alice is received by all listed members (bob)."""
        alice, bob = two_peers
        # TODO:
        #   1. alice sends GroupMsg(group_id="g1", members=["bob"], content="hi group")
        #   2. Assert bob receives it
        pass
