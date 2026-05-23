"""
api_bridge.py — FastAPI REST + WebSocket bridge between the React frontend and peer node.

Endpoints:
  POST /register                 — register this peer with the bootstrap server
  GET  /peers                    — return the current live peer list
  POST /send                     — send a 1-to-1 ChatMsg to a peer
  POST /group/send               — broadcast a GroupMsg to a group
  GET  /messages/{peer_id}       — poll inbox for messages from peer_id
  GET  /messages/group/{group_id}— poll inbox for group messages
  WS   /ws/{peer_id}             — WebSocket stream for real-time delivery
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from peer_node import PeerNode

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [api] %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.peer_node = None
    app.state.ws_connections = {}
    app.state.loop = asyncio.get_event_loop()
    task = asyncio.create_task(_ping_loop(app))
    yield
    task.cancel()
    if app.state.peer_node:
        app.state.peer_node.stop()


app = FastAPI(title="P2P Chat API", version="1.0", lifespan=lifespan)

# CORS must be configured before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _ping_loop(app: FastAPI) -> None:
    """Send PING to all connected WebSocket clients every 30s; remove dead ones."""
    while True:
        await asyncio.sleep(30)
        dead = []
        for pid, ws in list(app.state.ws_connections.items()):
            try:
                await ws.send_json({"type": "PING", "timestamp": time.time()})
            except Exception:
                dead.append(pid)
        for pid in dead:
            app.state.ws_connections.pop(pid, None)


async def push_to_frontend(app: FastAPI, peer_id: str, event: dict) -> None:
    """Push an event dict to the WebSocket client identified by peer_id."""
    ws = app.state.ws_connections.get(peer_id)
    if ws:
        try:
            await ws.send_json(event)
        except Exception as e:
            logger.debug(f"WS push failed for {peer_id}: {e}")
            app.state.ws_connections.pop(peer_id, None)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str
    port: int = 7001
    bootstrap_host: str = "localhost"
    bootstrap_port: int = 9000


class SendMessageRequest(BaseModel):
    from_id: str
    to_id: str
    content: str


class GroupSendRequest(BaseModel):
    from_id: str
    group_id: str
    member_ids: List[str]
    content: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ok(data, message: str = "ok") -> dict:
    return {"success": True, "data": data, "message": message}


def fail(message: str, code: int = 400):
    raise HTTPException(
        status_code=code,
        detail={"success": False, "data": None, "message": message}
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/register")
async def register(body: RegisterRequest):
    if len(body.username) < 3 or len(body.username) > 20:
        fail("username must be 3-20 characters")
    if app.state.peer_node is not None:
        fail("already registered", code=409)

    try:
        node = PeerNode(
            username=body.username,
            port=body.port,
            bootstrap_host=body.bootstrap_host,
            bootstrap_port=body.bootstrap_port
        )
        node.start()
    except Exception as e:
        logger.error(f"Failed to start peer node: {e}")
        fail(f"Failed to start: {e}", code=500)

    # Wire up WS push callback (thread-safe via run_coroutine_threadsafe)
    loop = app.state.loop

    def on_message(_from_id: str, event: dict) -> None:
        if node.peer_id in app.state.ws_connections:
            asyncio.run_coroutine_threadsafe(
                push_to_frontend(app, node.peer_id, event), loop
            )

    node.on_message_callback = on_message
    app.state.peer_node = node

    peers = [p.model_dump() for p in node.get_peers()]
    return ok({
        "peer_id": node.peer_id,
        "username": node.username,
        "peers": peers
    })


@app.get("/peers")
async def get_peers():
    if not app.state.peer_node:
        fail("not registered", code=400)
    peers = [p.model_dump() for p in app.state.peer_node.get_peers()]
    return ok(peers)


@app.post("/send")
async def send_message(body: SendMessageRequest):
    if not app.state.peer_node:
        fail("not registered")
    if not body.content or not body.content.strip():
        fail("content cannot be empty")
    if len(body.content) > 2000:
        fail("content too long (max 2000 chars)")

    node = app.state.peer_node
    result = node.send_direct(body.to_id, body.content)
    return ok(result)


@app.post("/group/send")
async def send_group_message(body: GroupSendRequest):
    if not app.state.peer_node:
        fail("not registered")
    if not body.member_ids:
        fail("member_ids cannot be empty")
    node = app.state.peer_node
    if node.peer_id in body.member_ids:
        fail("from_id cannot be in member_ids")

    result = node.send_group(body.group_id, body.member_ids, body.content)
    return ok(result)


@app.get("/messages/group/{group_id}")
async def get_group_messages(
    group_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    before: Optional[float] = Query(default=None)
):
    if not app.state.peer_node:
        fail("not registered")
    msgs = app.state.peer_node.get_group_messages(group_id)
    if before is not None:
        msgs = [m for m in msgs if m.get("timestamp", 0) < before]
    msgs = msgs[-limit:]
    return ok(msgs)


@app.get("/messages/{peer_id}")
async def get_messages(
    peer_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    before: Optional[float] = Query(default=None)
):
    if not app.state.peer_node:
        fail("not registered")
    msgs = app.state.peer_node.get_messages(peer_id)
    if before is not None:
        msgs = [m for m in msgs if m.get("timestamp", 0) < before]
    msgs = msgs[-limit:]
    return ok(msgs)


@app.websocket("/ws/{peer_id}")
async def websocket_endpoint(websocket: WebSocket, peer_id: str):
    await websocket.accept()
    app.state.ws_connections[peer_id] = websocket
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        app.state.ws_connections.pop(peer_id, None)
        logger.info(f"WS disconnected: {peer_id}")


if __name__ == "__main__":
    uvicorn.run("api_bridge:app", host="0.0.0.0", port=8000, reload=True)
