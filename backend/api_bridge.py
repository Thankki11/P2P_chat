"""
api_bridge.py — FastAPI REST + WebSocket bridge between the React frontend and peer node.

Supports multiple simultaneous users on the same server instance.
Each POST /register creates an independent PeerNode keyed by peer_id.
All read endpoints require ?me=<peer_id> to identify the caller.

Endpoints:
  POST /register                       — register a new peer (multi-user safe)
  GET  /peers?me=<peer_id>             — live peer list for this user
  POST /send                           — send a 1-to-1 ChatMsg (from_id identifies caller)
  POST /group/send                     — broadcast GroupMsg  (from_id identifies caller)
  GET  /messages/{peer_id}?me=<id>     — inbox for this user filtered by peer
  GET  /messages/group/{gid}?me=<id>   — group inbox for this user
  WS   /ws/{peer_id}                   — real-time push stream
"""

import asyncio
import logging
import socket
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


GRACE_PERIOD = 60  # seconds — WS disconnect → wait this long before tearing down PeerNode


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.peer_nodes = {}        # {peer_id: PeerNode}
    app.state.ws_connections = {}    # {peer_id: WebSocket}
    app.state.grace_timers = {}      # {peer_id: asyncio.Task}
    app.state.loop = asyncio.get_event_loop()
    task = asyncio.create_task(_ping_loop(app))
    yield
    task.cancel()
    for t in list(app.state.grace_timers.values()):
        t.cancel()
    for node in app.state.peer_nodes.values():
        try:
            node.stop()
        except Exception:
            pass


async def _disconnect_after_grace(peer_id: str) -> None:
    """After GRACE_PERIOD with no WS reconnect, tear down the PeerNode."""
    try:
        await asyncio.sleep(GRACE_PERIOD)
        node = app.state.peer_nodes.pop(peer_id, None)
        if node:
            try:
                node.stop()
            except Exception:
                pass
            logger.info(f"Peer {peer_id} disconnected after {GRACE_PERIOD}s grace")
    except asyncio.CancelledError:
        pass
    finally:
        app.state.grace_timers.pop(peer_id, None)


app = FastAPI(title="P2P Chat API", version="1.0", lifespan=lifespan)

# CORS must be configured before any routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

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


def _lookup(peer_id: str) -> PeerNode:
    """Resolve peer_id → PeerNode or raise 400."""
    node = app.state.peer_nodes.get(peer_id)
    if not node:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "data": None, "message": "peer not registered"}
        )
    return node


def ok(data, message: str = "ok") -> dict:
    return {"success": True, "data": data, "message": message}


def fail(message: str, code: int = 400):
    raise HTTPException(
        status_code=code,
        detail={"success": False, "data": None, "message": message}
    )


def _is_port_available(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.2):
            return False
    except (ConnectionRefusedError, TimeoutError, OSError):
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("0.0.0.0", port))
            return True
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str
    port: int = 7001
    bootstrap_host: str = "localhost"
    bootstrap_port: int = 9000
    public_key: str = ""
    peer_id: str = ""  # optional: resume previous identity


class SendMessageRequest(BaseModel):
    from_id: str
    to_id: str
    content: str


class GroupSendRequest(BaseModel):
    from_id: str
    group_id: str
    member_ids: List[str]
    content: str


class GroupCreateRequest(BaseModel):
    from_id: str
    group_id: str
    name: str
    member_ids: List[str]


class LogoutRequest(BaseModel):
    peer_id: str


class PresenceRequest(BaseModel):
    peer_id: str
    online: bool


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/register")
async def register(body: RegisterRequest):
    if len(body.username) < 3 or len(body.username) > 20:
        fail("username must be 3-20 characters")
    if body.port < 1024 or body.port > 65535:
        fail("port must be in range 1024-65535")

    # Idempotent: if the requested peer_id is already alive → return it as-is
    if body.peer_id and body.peer_id in app.state.peer_nodes:
        node = app.state.peer_nodes[body.peer_id]
        peers = [p.model_dump() for p in node.get_peers()]
        return ok({"peer_id": node.peer_id, "username": node.username, "peers": peers})

    # Idempotent: same username already registered → return existing node
    for node in app.state.peer_nodes.values():
        if node.username == body.username:
            peers = [p.model_dump() for p in node.get_peers()]
            return ok({"peer_id": node.peer_id, "username": node.username, "peers": peers})

    for node in app.state.peer_nodes.values():
        if node.port == body.port:
            fail(f"port {body.port} is already in use", code=409)

    if not _is_port_available(body.port):
        fail(f"port {body.port} is already in use", code=409)

    try:
        node = PeerNode(
            username=body.username,
            port=body.port,
            bootstrap_host=body.bootstrap_host,
            bootstrap_port=body.bootstrap_port,
            public_key=body.public_key,
            peer_id=body.peer_id,   # empty → auto-generate; provided → resume
        )
        node.start()
    except Exception as e:
        logger.error(f"Failed to start peer node: {e}")
        fail(f"Failed to start: {e}", code=500)

    # Wire WS push callback — captures this specific node via closure
    loop = app.state.loop

    def on_message(_from_id: str, event: dict) -> None:
        if node.peer_id in app.state.ws_connections:
            asyncio.run_coroutine_threadsafe(
                push_to_frontend(app, node.peer_id, event), loop
            )

    node.on_message_callback = on_message
    app.state.peer_nodes[node.peer_id] = node

    peers = [p.model_dump() for p in node.get_peers()]
    logger.info(f"Registered: {body.username} ({node.peer_id})")
    return ok({"peer_id": node.peer_id, "username": node.username, "peers": peers})


@app.get("/peers")
async def get_peers(me: str = Query(..., description="caller's peer_id")):
    node = _lookup(me)
    peers = [p.model_dump() for p in node.get_peers()]
    return ok(peers)


@app.post("/presence")
async def set_presence(body: PresenceRequest):
    node = _lookup(body.peer_id)
    node.set_presence(body.online)
    return ok({"peer_id": body.peer_id, "online": body.online})


@app.post("/logout")
async def logout(body: LogoutRequest):
    node = app.state.peer_nodes.pop(body.peer_id, None)
    if node:
        try:
            node.stop()
        except Exception:
            pass
    app.state.ws_connections.pop(body.peer_id, None)
    logger.info(f"Logged out: {body.peer_id}")
    return ok(None, "logged out")


@app.post("/send")
async def send_message(body: SendMessageRequest):
    if not body.content or not body.content.strip():
        fail("content cannot be empty")
    if len(body.content) > 2000:
        fail("content too long (max 2000 chars)")
    node = _lookup(body.from_id)
    result = node.send_direct(body.to_id, body.content)
    return ok(result)


@app.post("/group/send")
async def send_group_message(body: GroupSendRequest):
    if not body.member_ids:
        fail("member_ids cannot be empty")
    node = _lookup(body.from_id)
    if node.peer_id in body.member_ids:
        fail("sender cannot be in member_ids")
    result = node.send_group(body.group_id, body.member_ids, body.content)
    return ok(result)


@app.post("/group/create")
async def create_group(body: GroupCreateRequest):
    if not body.group_id.strip():
        fail("group_id cannot be empty")
    if not body.name.strip():
        fail("group name cannot be empty")
    if not body.member_ids:
        fail("member_ids cannot be empty")

    node = _lookup(body.from_id)
    if node.peer_id in body.member_ids:
        fail("sender cannot be in member_ids")

    event = {
        "type": "GROUP_CREATED",
        "group_id": body.group_id,
        "name": body.name,
        "from_id": node.peer_id,
        "from_username": node.username,
        "member_ids": body.member_ids,
        "timestamp": time.time(),
    }

    for member_id in body.member_ids:
        await push_to_frontend(app, member_id, event)

    return ok(event)


@app.get("/messages/group/{group_id}")
async def get_group_messages(
    group_id: str,
    me: str = Query(..., description="caller's peer_id"),
    limit: int = Query(default=50, ge=1, le=500),
    before: Optional[float] = Query(default=None),
):
    node = _lookup(me)
    msgs = node.get_group_messages(group_id)
    if before is not None:
        msgs = [m for m in msgs if m.get("timestamp", 0) < before]
    return ok(msgs[-limit:])


@app.get("/messages/{peer_id}")
async def get_messages(
    peer_id: str,
    me: str = Query(..., description="caller's peer_id"),
    limit: int = Query(default=50, ge=1, le=500),
    before: Optional[float] = Query(default=None),
):
    node = _lookup(me)
    msgs = node.get_messages(peer_id)
    if before is not None:
        msgs = [m for m in msgs if m.get("timestamp", 0) < before]
    return ok(msgs[-limit:])


@app.websocket("/ws/{peer_id}")
async def websocket_endpoint(websocket: WebSocket, peer_id: str):
    await websocket.accept()

    pending = app.state.grace_timers.pop(peer_id, None)
    if pending:
        pending.cancel()
        logger.info(f"WS reconnected for {peer_id}, grace cancelled")

    app.state.ws_connections[peer_id] = websocket
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if app.state.ws_connections.get(peer_id) is websocket:
            app.state.ws_connections.pop(peer_id, None)
            app.state.grace_timers[peer_id] = asyncio.create_task(
                _disconnect_after_grace(peer_id)
            )
            logger.info(f"WS disconnected: {peer_id}, grace started ({GRACE_PERIOD}s)")


if __name__ == "__main__":
    uvicorn.run("api_bridge:app", host="0.0.0.0", port=8000, reload=True)
