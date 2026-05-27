"""
protocol.py — Shared message protocol for the P2P Chat System.

Defines MsgType enum, all 8 Pydantic message models, and JSON encode/decode helpers
used by both the bootstrap server and peer nodes.
"""

import json
import uuid
from enum import Enum
from typing import Any, Dict, List
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Message type enum
# ---------------------------------------------------------------------------

class MsgType(str, Enum):
    REGISTER       = "REGISTER"
    PEER_LIST      = "PEER_LIST"
    CHAT_MSG       = "CHAT_MSG"
    GROUP_MSG      = "GROUP_MSG"
    HEARTBEAT      = "HEARTBEAT"
    PEER_HEARTBEAT = "PEER_HEARTBEAT"
    ACK            = "ACK"
    STORE_FWD      = "STORE_FWD"
    STATUS_UPDATE  = "STATUS_UPDATE"


# ---------------------------------------------------------------------------
# Shared sub-model
# ---------------------------------------------------------------------------

class PeerInfo(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    peer_id: str
    username: str
    host: str
    port: int
    online: bool = True
    last_seen: float = 0.0
    public_key: str = ""


# ---------------------------------------------------------------------------
# Message models
# ---------------------------------------------------------------------------

class RegisterMsg(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: str = Field(default=MsgType.REGISTER)
    peer_id: str
    username: str
    host: str
    port: int
    public_key: str = ""


class PeerListMsg(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: str = Field(default=MsgType.PEER_LIST)
    peers: List[PeerInfo] = Field(default_factory=list)


class ChatMsg(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: str = Field(default=MsgType.CHAT_MSG)
    msg_id: str
    from_id: str
    from_username: str = ""
    to_id: str
    content: str
    timestamp: float
    delivered: bool = False


class GroupMsg(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: str = Field(default=MsgType.GROUP_MSG)
    msg_id: str
    from_id: str
    from_username: str = ""
    group_id: str
    member_ids: List[str]
    content: str
    timestamp: float


class HeartbeatMsg(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: str = Field(default=MsgType.HEARTBEAT)
    peer_id: str
    timestamp: float


class PeerHeartbeatMsg(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: str = Field(default=MsgType.PEER_HEARTBEAT)
    from_id: str
    timestamp: float


class AckMsg(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: str = Field(default=MsgType.ACK)
    msg_id: str
    status: str  # ok | queued | error


class StoreFwdMsg(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: str = Field(default=MsgType.STORE_FWD)
    msg_id: str
    target_id: str
    payload: Dict[str, Any]


class StatusUpdateMsg(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    type: str = Field(default=MsgType.STATUS_UPDATE)
    peer_id: str
    online: bool


# ---------------------------------------------------------------------------
# Encode / decode helpers
# ---------------------------------------------------------------------------

def encode(msg: BaseModel) -> bytes:
    """Serialise a Pydantic message model to UTF-8 JSON bytes with newline delimiter."""
    return (msg.model_dump_json() + "\n").encode("utf-8")


def decode(raw: str) -> dict:
    """Deserialise raw JSON string into a dict."""
    return json.loads(raw.strip())


def make_id() -> str:
    """Generate a unique message/peer ID."""
    return str(uuid.uuid4())
