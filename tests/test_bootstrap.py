"""
test_bootstrap.py — Integration tests for the bootstrap server.

Tests:
  - A peer sends REGISTER and receives a PEER_LIST back.
  - A peer that stops sending heartbeats is eventually evicted.
"""

import pytest
import socket
import threading
import time
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from protocol import (
    PeerInfo, RegisterMsg, PeerListMsg, HeartbeatMsg,
    encode, decode,
)


# Use a non-conflicting port for tests
TEST_PORT = 19000


@pytest.fixture(scope="module")
def bootstrap_server():
    """Start a bootstrap server instance in a background thread for the test module."""
    # TODO: import and start bootstrap_server.start_server() on TEST_PORT
    # Yield control to tests, then stop the server
    yield TEST_PORT


class TestRegisterAndPeerList:
    def test_register_returns_peer_list(self, bootstrap_server):
        """After REGISTER, server should immediately respond with PEER_LIST."""
        # TODO:
        #   1. Connect TCP socket to bootstrap_server port
        #   2. Send RegisterMsg for "alice"
        #   3. Read response, decode as PeerListMsg
        #   4. Assert type is PEER_LIST
        pass

    def test_two_peers_see_each_other(self, bootstrap_server):
        """Second peer's PEER_LIST should include the first registered peer."""
        # TODO:
        #   1. Register "alice"
        #   2. Register "bob"
        #   3. Assert bob's PEER_LIST contains alice
        pass


class TestHeartbeatTimeout:
    def test_peer_evicted_after_timeout(self, bootstrap_server):
        """Peer that stops heartbeating should disappear from the registry."""
        # TODO:
        #   1. Register "ghost" peer
        #   2. Wait longer than HEARTBEAT_TIMEOUT
        #   3. Register a new peer and check its PEER_LIST excludes "ghost"
        pass
