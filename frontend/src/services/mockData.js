const now = Math.floor(Date.now() / 1000)

export const mockCurrentUser = {
  peer_id: '550e8400-e29b-41d4-a716-446655440000',
  username: 'alice',
  port: 7001,
}

export const mockPeers = [
  {
    peer_id: '661f9511-f30c-52e5-b827-557766551111',
    username: 'bob',
    host: '127.0.0.1',
    port: 7002,
    online: true,
    last_seen: now,
  },
  {
    peer_id: '772a0622-g41d-63f6-c938-668877662222',
    username: 'charlie',
    host: '127.0.0.1',
    port: 7003,
    online: false,
    last_seen: now - 120,
  },
]

export const mockMessages = [
  {
    msg_id: 'mock-1',
    from_id: mockCurrentUser.peer_id,
    to_id: mockPeers[0].peer_id,
    content: 'Xin chao Bob!',
    timestamp: now - 120,
    delivered: true,
    from_username: 'alice',
  },
  {
    msg_id: 'mock-2',
    from_id: mockPeers[0].peer_id,
    to_id: mockCurrentUser.peer_id,
    content: 'Chao Alice! Co gi khong?',
    timestamp: now - 60,
    delivered: true,
    from_username: 'bob',
  },
]
