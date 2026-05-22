"""
test_protocol.py — Unit tests for protocol.py encode/decode and Pydantic validation.
"""

import pytest
from pydantic import ValidationError

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from protocol import (
    MsgType, PeerInfo, RegisterMsg, PeerListMsg, ChatMsg,
    GroupMsg, HeartbeatMsg, AckMsg, StoreFwdMsg,
    encode, decode,
)


class TestPeerInfo:
    def test_address_format(self):
        """address() should return 'host:port'."""
        peer = PeerInfo(username="alice", host="127.0.0.1", port=6001)
        assert peer.address() == "127.0.0.1:6001"

    def test_missing_field_raises(self):
        """Missing required field should raise ValidationError."""
        with pytest.raises(ValidationError):
            PeerInfo(username="alice", host="127.0.0.1")  # port missing


class TestEncodeDecode:
    def test_register_roundtrip(self):
        """encode then decode of RegisterMsg should produce an equal object."""
        msg = RegisterMsg(peer=PeerInfo(username="alice", host="127.0.0.1", port=6001))
        result = decode(encode(msg))
        assert isinstance(result, RegisterMsg)
        assert result.peer.username == "alice"

    def test_chat_roundtrip(self):
        """ChatMsg encode/decode roundtrip preserves all fields."""
        msg = ChatMsg(sender="alice", recipient="bob", content="hello")
        result = decode(encode(msg))
        assert isinstance(result, ChatMsg)
        assert result.content == "hello"
        assert result.sender == "alice"

    def test_peer_list_roundtrip(self):
        """PeerListMsg with multiple peers survives encode/decode."""
        peers = [
            PeerInfo(username="bob", host="127.0.0.1", port=6002),
            PeerInfo(username="carol", host="127.0.0.1", port=6003),
        ]
        msg = PeerListMsg(peers=peers)
        result = decode(encode(msg))
        assert isinstance(result, PeerListMsg)
        assert len(result.peers) == 2

    def test_unknown_type_raises(self):
        """decode should raise ValueError for an unknown message type."""
        import json
        bad_json = json.dumps({"type": "UNKNOWN_TYPE"})
        with pytest.raises(ValueError):
            decode(bad_json)

    def test_missing_type_raises(self):
        """decode should raise ValueError when 'type' key is absent."""
        import json
        bad_json = json.dumps({"content": "hi"})
        with pytest.raises(ValueError):
            decode(bad_json)

    def test_encode_has_newline(self):
        """encode() output should end with a newline byte for readline()."""
        msg = HeartbeatMsg(username="alice")
        raw = encode(msg)
        assert raw.endswith(b"\n")
