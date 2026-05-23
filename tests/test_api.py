import sys, os, time, threading, asyncio
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from bootstrap_server import BootstrapServer
from message_handler import MessageHandler

BPORT = 19300


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def run_bootstrap():
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


@pytest_asyncio.fixture(scope="module")
async def client(run_bootstrap):
    import importlib
    import api_bridge as ab
    importlib.reload(ab)

    # Manually seed app.state (multi-user: peer_nodes dict)
    ab.app.state.peer_nodes = {}
    ab.app.state.ws_connections = {}
    ab.app.state.loop = asyncio.get_event_loop()

    async with AsyncClient(transport=ASGITransport(app=ab.app), base_url="http://test") as c:
        yield c

    for node in ab.app.state.peer_nodes.values():
        try:
            node.stop()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _register(client, username="apitest", port=17201):
    resp = await client.post("/register", json={
        "username": username,
        "port": port,
        "bootstrap_host": "127.0.0.1",
        "bootstrap_port": BPORT,
    })
    return resp


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_success(client):
    resp = await _register(client, "apitest", 17201)
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "peer_id" in body["data"]
    assert body["data"]["username"] == "apitest"
    import uuid
    uuid.UUID(body["data"]["peer_id"])


@pytest.mark.asyncio
async def test_register_second_user(client):
    """Second user gets their own peer_id, not the first user's."""
    resp = await _register(client, "apitest2", 17202)
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["username"] == "apitest2"

    # Both users registered and have distinct peer_ids
    resp1 = await _register(client, "apitest", 17201)
    assert resp1.json()["data"]["peer_id"] != body["data"]["peer_id"]


@pytest.mark.asyncio
async def test_register_idempotent(client):
    """Re-registering same username returns same peer_id."""
    r1 = await _register(client, "apitest", 17201)
    r2 = await _register(client, "apitest", 17201)
    assert r1.json()["data"]["peer_id"] == r2.json()["data"]["peer_id"]


@pytest.mark.asyncio
async def test_register_short_username(client):
    resp = await client.post("/register", json={"username": "ab", "port": 17299})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_peers(client):
    r = await _register(client, "apitest", 17201)
    peer_id = r.json()["data"]["peer_id"]
    resp = await client.get("/peers", params={"me": peer_id})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


@pytest.mark.asyncio
async def test_get_peers_missing_me(client):
    """?me is required — omitting it returns 422."""
    resp = await client.get("/peers")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_send_empty_content(client):
    resp = await client.post("/send", json={
        "from_id": "x", "to_id": "y", "content": ""
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_send_to_unknown_peer(client):
    r = await _register(client, "apitest", 17201)
    from_id = r.json()["data"]["peer_id"]
    resp = await client.post("/send", json={
        "from_id": from_id, "to_id": "nonexistent-0000", "content": "hi"
    })
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] in ("ok", "queued")


@pytest.mark.asyncio
async def test_group_send_empty_members(client):
    resp = await client.post("/group/send", json={
        "from_id": "x", "group_id": "g1", "member_ids": [], "content": "hi"
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_messages(client):
    r = await _register(client, "apitest", 17201)
    peer_id = r.json()["data"]["peer_id"]
    resp = await client.get("/messages/some-peer-id", params={"me": peer_id})
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert isinstance(resp.json()["data"], list)


@pytest.mark.asyncio
async def test_get_group_messages(client):
    r = await _register(client, "apitest", 17201)
    peer_id = r.json()["data"]["peer_id"]
    resp = await client.get("/messages/group/g1", params={"me": peer_id})
    assert resp.status_code == 200
    assert resp.json()["success"] is True
