import sys, os, socket, time, threading
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import pytest
from bootstrap_server import BootstrapServer
from message_handler import MessageHandler
from protocol import RegisterMsg, HeartbeatMsg, MsgType, encode, decode, make_id

BPORT = 19100  # unique test port


@pytest.fixture(scope="module")
def bootstrap():
    server = BootstrapServer()
    server.HEARTBEAT_TIMEOUT = 3  # short for testing
    server.message_handler = MessageHandler()
    t = threading.Thread(
        target=server.start,
        kwargs={"host": "127.0.0.1", "port": BPORT},
        daemon=True
    )
    t.start()
    time.sleep(0.3)
    yield server


def connect_and_register(port, peer_id, username, peer_port):
    conn = socket.create_connection(("127.0.0.1", port), timeout=5)
    reg = RegisterMsg(peer_id=peer_id, username=username, host="127.0.0.1", port=peer_port)
    conn.sendall(encode(reg))
    return conn


def read_response(conn):
    f = conn.makefile("r", encoding="utf-8")
    line = f.readline()
    return decode(line)


def test_register_returns_peer_list(bootstrap):
    pid = make_id()
    conn = connect_and_register(BPORT, pid, "tester1", 20001)
    data = read_response(conn)
    assert data["type"] == MsgType.PEER_LIST
    assert isinstance(data["peers"], list)
    conn.close()
    time.sleep(0.1)


def test_two_peers_see_each_other(bootstrap):
    pid1 = make_id()
    pid2 = make_id()
    conn1 = connect_and_register(BPORT, pid1, "alice2", 20002)
    read_response(conn1)  # alice gets empty list (no one else yet in this scope)

    conn2 = connect_and_register(BPORT, pid2, "bob2", 20003)
    data2 = read_response(conn2)  # bob should see alice in peer list

    bob_peers = [p["username"] for p in data2["peers"]]
    assert "alice2" in bob_peers
    conn1.close()
    conn2.close()
    time.sleep(0.1)


def test_heartbeat_updates_last_seen(bootstrap):
    pid = make_id()
    conn = connect_and_register(BPORT, pid, "hb_user", 20004)
    read_response(conn)  # consume peer list
    before = bootstrap.last_seen.get(pid, 0)
    time.sleep(0.05)
    hb = HeartbeatMsg(peer_id=pid, timestamp=time.time())
    conn.sendall(encode(hb))
    time.sleep(0.1)
    after = bootstrap.last_seen.get(pid, 0)
    assert after > before
    conn.close()
    time.sleep(0.1)


def test_peer_evicted_after_timeout(bootstrap):
    pid = make_id()
    conn = connect_and_register(BPORT, pid, "ghost_user", 20005)
    read_response(conn)
    # Close connection abruptly — no more heartbeats
    conn.close()
    # Manually trigger cleanup since _cleanup_loop sleeps 30s
    # but HEARTBEAT_TIMEOUT=3, so just call it directly
    time.sleep(3.5)
    bootstrap._cleanup_loop_once()
    online_ids = [p.peer_id for p in bootstrap.get_online_peers()]
    assert pid not in online_ids
