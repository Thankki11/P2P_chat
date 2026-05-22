// mockData.js — Static mock data for frontend development without a running backend.
//               Import these in components during early dev / Storybook usage.

export const mockPeers = [
  { username: 'bob',   host: '127.0.0.1', port: 6002, online: true,  unread: 3 },
  { username: 'carol', host: '127.0.0.1', port: 6003, online: true,  unread: 0 },
  { username: 'dave',  host: '127.0.0.1', port: 6004, online: false, unread: 1 },
]

export const mockMessages = [
  {
    sender: 'alice',
    recipient: 'bob',
    content: 'Hey Bob! Are you there?',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    isMe: true,
  },
  {
    sender: 'bob',
    recipient: 'alice',
    content: 'Yes! Connected via P2P.',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    isMe: false,
  },
  {
    sender: 'alice',
    recipient: 'bob',
    content: 'Nice, the protocol works!',
    timestamp: new Date().toISOString(),
    isMe: true,
  },
]

export const mockGroups = [
  { id: 'team-alpha', members: ['alice', 'bob', 'carol'] },
]
