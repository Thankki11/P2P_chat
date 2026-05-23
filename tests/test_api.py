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

    # Manually seed app.state so the lifespan isn't required for tests
    ab.app.state.peer_node = None
    ab.app.state.ws_connections = {}
    ab.app.state.loop = asyncio.get_event_loop()

    async with AsyncClient(transport=ASGITransport(app=ab.app), base_url="http://test") as c:
        yield c
    # Clean up peer node if registered during tests
    if ab.app.state.peer_node:
        ab.app.state.peer_node.stop()


@pytest.mark.asyncio
async def test_register_success(client):
    resp = await client.post("/register", json={
        "username": "apitest",
        "port": 17201,
        "bootstrap_host": "127.0.0.1",
        "bootstrap_port": BPORT
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert "peer_id" in body["data"]
    assert body["data"]["username"] == "apitest"
    import uuid
    uuid.UUID(body["data"]["peer_id"])  # should not raise


@pytest.mark.asyncio
async def test_register_short_username(client):
    resp = await client.post("/register", json={"username": "ab", "port": 17202})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_peers(client):
    resp = await client.get("/peers")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


@pytest.mark.asyncio
async def test_send_empty_content(client):
    resp = await client.post("/send", json={
        "from_id": "x", "to_id": "y", "content": ""
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_send_to_unknown_peer(client):
    resp = await client.post("/send", json={
        "from_id": "x", "to_id": "nonexistent-0000", "content": "hi"
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["status"] in ("ok", "queued")


@pytest.mark.asyncio
async def test_group_send_empty_members(client):
    resp = await client.post("/group/send", json={
        "from_id": "x", "group_id": "g1", "member_ids": [], "content": "hi"
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_messages(client):
    resp = await client.get("/messages/some-peer-id")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


@pytest.mark.asyncio
async def test_get_group_messages(client):
    resp = await client.get("/messages/group/g1")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)
