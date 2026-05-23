import uuid, time, json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import pytest
from pydantic import ValidationError
from protocol import (MsgType, PeerListMsg, ChatMsg,
                       GroupMsg, HeartbeatMsg, AckMsg, StoreFwdMsg,
                       encode, decode, make_id)


def test_msg_type_values():
    values = {e.value for e in MsgType}
    assert "REGISTER" in values
    assert "PEER_LIST" in values
    assert "CHAT_MSG" in values
    assert "GROUP_MSG" in values
    assert "HEARTBEAT" in values
    assert "ACK" in values
    assert "STORE_FWD" in values
    assert len(values) == 7


def test_make_id_is_uuid():
    id_ = make_id()
    parsed = uuid.UUID(id_)
    assert str(parsed) == id_


def test_encode_produces_bytes_ending_newline():
    msg = HeartbeatMsg(peer_id="abc", timestamp=time.time())
    raw = encode(msg)
    assert isinstance(raw, bytes)
    assert raw.endswith(b"\n")


def test_decode_parses_json():
    data = {"type": "HEARTBEAT", "peer_id": "abc", "timestamp": 1234.0}
    result = decode(json.dumps(data))
    assert result["type"] == "HEARTBEAT"
    assert result["peer_id"] == "abc"


def test_chat_msg_roundtrip():
    msg = ChatMsg(msg_id=make_id(), from_id="a", to_id="b",
                   content="hello", timestamp=time.time())
    raw = encode(msg)
    data = decode(raw.decode("utf-8"))
    assert data["content"] == "hello"
    assert data["from_id"] == "a"


def test_chat_msg_missing_content_raises():
    with pytest.raises((ValidationError, TypeError)):
        ChatMsg(msg_id=make_id(), from_id="a", to_id="b", timestamp=time.time())


def test_peer_list_msg_empty_peers():
    msg = PeerListMsg(peers=[])
    raw = encode(msg)
    data = decode(raw.decode("utf-8"))
    assert data["peers"] == []


def test_group_msg_has_member_ids():
    msg = GroupMsg(msg_id=make_id(), from_id="a", group_id="g1",
                    member_ids=["b", "c"], content="hi", timestamp=time.time())
    raw = encode(msg)
    data = decode(raw.decode("utf-8"))
    assert "b" in data["member_ids"]


def test_store_fwd_msg():
    msg = StoreFwdMsg(msg_id=make_id(), target_id="bob",
                       payload={"content": "queued"})
    raw = encode(msg)
    data = decode(raw.decode("utf-8"))
    assert data["target_id"] == "bob"
    assert data["payload"]["content"] == "queued"


def test_ack_msg_status():
    msg = AckMsg(msg_id=make_id(), status="ok")
    raw = encode(msg)
    data = decode(raw.decode("utf-8"))
    assert data["status"] == "ok"
