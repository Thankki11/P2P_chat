"""
protocol.py — Shared message protocol for the P2P Chat System.

Defines all Pydantic message models and JSON encode/decode helpers
used by both the bootstrap server and peer nodes.
"""

import json
from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


# ---------------------------------------------------------------------------
# Message type enum
# ---------------------------------------------------------------------------

class MsgType(str, Enum):
    REGISTER     = "REGISTER"
    PEER_LIST    = "PEER_LIST"
    CHAT         = "CHAT"
    GROUP        = "GROUP"
    HEARTBEAT    = "HEARTBEAT"
    ACK          = "ACK"
    STORE_FWD    = "STORE_FWD"


# ---------------------------------------------------------------------------
# Shared sub-model
# ---------------------------------------------------------------------------

class PeerInfo(BaseModel):
    """Identifies a single peer on the network."""
    username: str
    host: str
    port: int

    def address(self) -> str:
        return f"{self.host}:{self.port}"


# ---------------------------------------------------------------------------
# Message models
# ---------------------------------------------------------------------------

class RegisterMsg(BaseModel):
    """Sent by a peer to the bootstrap server to announce itself."""
    type: MsgType = MsgType.REGISTER
    peer: PeerInfo


class PeerListMsg(BaseModel):
    """Sent by the bootstrap server in response to REGISTER; carries the
    current list of known live peers (excluding the requesting peer)."""
    type: MsgType = MsgType.PEER_LIST
    peers: List[PeerInfo] = Field(default_factory=list)


class ChatMsg(BaseModel):
    """Direct 1-to-1 chat message between two peers."""
    type: MsgType = MsgType.CHAT
    sender: str
    recipient: str
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    msg_id: Optional[str] = None


class GroupMsg(BaseModel):
    """Broadcast message sent to a named group of peers."""
    type: MsgType = MsgType.GROUP
    sender: str
    group_id: str
    members: List[str]
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    msg_id: Optional[str] = None


class HeartbeatMsg(BaseModel):
    """Periodic keep-alive sent by a peer to the bootstrap server."""
    type: MsgType = MsgType.HEARTBEAT
    username: str


class AckMsg(BaseModel):
    """Acknowledgement returned after a message is delivered."""
    type: MsgType = MsgType.ACK
    msg_id: str
    status: str = "ok"


class StoreFwdMsg(BaseModel):
    """Wrapper used by the store-and-forward queue when the target peer is
    offline; the inner payload is a serialised ChatMsg or GroupMsg."""
    type: MsgType = MsgType.STORE_FWD
    recipient: str
    payload: str          # JSON-encoded ChatMsg or GroupMsg
    queued_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    expires_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Encode / decode helpers
# ---------------------------------------------------------------------------

# Registry maps MsgType → model class for fast dispatch
_MSG_REGISTRY: dict[MsgType, type] = {
    MsgType.REGISTER:  RegisterMsg,
    MsgType.PEER_LIST: PeerListMsg,
    MsgType.CHAT:      ChatMsg,
    MsgType.GROUP:     GroupMsg,
    MsgType.HEARTBEAT: HeartbeatMsg,
    MsgType.ACK:       AckMsg,
    MsgType.STORE_FWD: StoreFwdMsg,
}


def encode(msg: BaseModel) -> bytes:
    """Serialise a Pydantic message model to UTF-8 JSON bytes.

    Appends a newline delimiter so the receiver can use readline().
    """
    return (msg.model_dump_json() + "\n").encode("utf-8")


def decode(data: str | bytes) -> BaseModel:
    """Deserialise raw JSON bytes/string into the appropriate Pydantic model.

    Raises:
        ValueError: if the 'type' field is missing or unrecognised.
        pydantic.ValidationError: if the payload does not match the model.
    """
    if isinstance(data, bytes):
        data = data.decode("utf-8").strip()
    raw: dict[str, Any] = json.loads(data)
    msg_type_str = raw.get("type")
    if msg_type_str is None:
        raise ValueError("Message missing 'type' field")
    try:
        msg_type = MsgType(msg_type_str)
    except ValueError:
        raise ValueError(f"Unknown message type: {msg_type_str!r}")
    model_cls = _MSG_REGISTRY[msg_type]
    return model_cls(**raw)
