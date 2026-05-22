"""
api_bridge.py — FastAPI REST + WebSocket bridge between the React frontend and peer node.

Exposes HTTP endpoints on port 8000 with CORS enabled for http://localhost:5173.
WebSocket endpoint streams incoming messages to the browser in real time.

Endpoints:
  POST /register                 — register this peer with the bootstrap server
  GET  /peers                    — return the current live peer list
  POST /send                     — send a 1-to-1 ChatMsg to a peer
  POST /group/send               — broadcast a GroupMsg to a group
  GET  /messages/{peer_id}       — poll inbox for messages from peer_id
  WS   /ws/{peer_id}             — WebSocket stream for real-time delivery
"""

import logging
from typing import Any, Dict, List

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger(__name__)

app = FastAPI(title="P2P Chat API Bridge")

# ---------------------------------------------------------------------------
# CORS — allow the Vite dev server origin
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / response schemas (bridge-level, not protocol-level)
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    """Body for POST /register.
    Fields: username (str), host (str, default "127.0.0.1"), port (int)
    """
    username: str
    host: str = "127.0.0.1"
    port: int


class RegisterResponse(BaseModel):
    """Response for POST /register.
    Fields: ok (bool), peers (list of peer dicts)
    """
    ok: bool
    peers: List[Dict[str, Any]] = []


class SendRequest(BaseModel):
    """Body for POST /send.
    Fields: recipient (str), content (str)
    """
    recipient: str
    content: str


class GroupSendRequest(BaseModel):
    """Body for POST /group/send.
    Fields: group_id (str), members (list[str]), content (str)
    """
    group_id: str
    members: List[str]
    content: str


class MessageResponse(BaseModel):
    """Single message entry returned by GET /messages/{peer_id}.
    Fields: sender, recipient, content, timestamp, msg_id
    """
    sender: str
    recipient: str
    content: str
    timestamp: str
    msg_id: str | None = None


# ---------------------------------------------------------------------------
# Active WebSocket connections: peer_id → WebSocket
# ---------------------------------------------------------------------------
active_connections: Dict[str, WebSocket] = {}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/register", response_model=RegisterResponse)
async def register(body: RegisterRequest):
    """Register this user's peer node with the bootstrap server.

    Expected behaviour:
      - Build a PeerInfo from body fields.
      - Call PeerNode.register_with_bootstrap() (or equivalent).
      - Return {ok: true, peers: [...]} with the received peer list.

    TODO: wire up to actual PeerNode instance.
    """
    # TODO: integrate with peer_node.register_with_bootstrap()
    return RegisterResponse(ok=True, peers=[])


@app.get("/peers")
async def get_peers():
    """Return the current live peer list from the bootstrap server.

    Expected response: [{username, host, port}, ...]

    TODO: query PeerNode or bootstrap server for fresh list.
    """
    # TODO: return peer_node.known_peers or re-query bootstrap
    return {"peers": []}


@app.post("/send")
async def send_message(body: SendRequest):
    """Send a 1-to-1 ChatMsg to the named recipient peer.

    Expected response: {ok: bool, msg_id: str}

    Request body: {recipient: str, content: str}
    TODO: resolve recipient PeerInfo, call connection_manager.send_to().
    """
    # TODO: lookup recipient in known peers, call send_direct / send_to
    return {"ok": True, "msg_id": None}


@app.post("/group/send")
async def send_group_message(body: GroupSendRequest):
    """Broadcast a GroupMsg to all members of a group.

    Expected response: {ok: bool, delivered: {username: bool, ...}}

    Request body: {group_id: str, members: [str, ...], content: str}
    TODO: build GroupMsg, call connection_manager.broadcast().
    """
    # TODO: build GroupMsg, broadcast, return per-member delivery status
    return {"ok": True, "delivered": {}}


@app.get("/messages/{peer_id}", response_model=List[MessageResponse])
async def get_messages(peer_id: str):
    """Poll the inbox for messages from (or to) peer_id.

    Expected response: [{sender, recipient, content, timestamp, msg_id}, ...]

    TODO: filter peer_node.get_messages() by peer_id.
    """
    # TODO: call peer_node.get_messages(), filter, return
    return []


@app.websocket("/ws/{peer_id}")
async def websocket_endpoint(websocket: WebSocket, peer_id: str):
    """WebSocket endpoint for real-time message delivery to the browser.

    On connect: register the socket in active_connections[peer_id].
    On incoming TCP message: push JSON to the browser.
    On disconnect: remove from active_connections.

    TODO: integrate with peer_node inbox or an asyncio queue.
    """
    await websocket.accept()
    active_connections[peer_id] = websocket
    try:
        while True:
            # Keep the connection alive; messages are pushed server-side
            data = await websocket.receive_text()
            # TODO: handle any client→server WS messages if needed
    except WebSocketDisconnect:
        active_connections.pop(peer_id, None)
        logger.info(f"WebSocket disconnected: {peer_id}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("api_bridge:app", host="0.0.0.0", port=8000, reload=True)
