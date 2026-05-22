// api.js — Axios instance and typed API functions for all backend REST calls.
import axios from 'axios'

const client = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Register this user with the bootstrap server via the API bridge.
 * POST /register  { username, host, port }
 * Returns: { ok: bool, peers: PeerInfo[] }
 */
export async function registerUser(username, serverHost) {
  // TODO: parse serverHost into host + port, call POST /register
  const { data } = await client.post('/register', { username, host: '127.0.0.1', port: 6001 })
  return data
}

/**
 * Fetch the current list of live peers.
 * GET /peers
 * Returns: { peers: PeerInfo[] }
 */
export async function getPeerList() {
  const { data } = await client.get('/peers')
  return data.peers ?? []
}

/**
 * Send a 1-to-1 chat message.
 * POST /send  { recipient: string, content: string }
 * Returns: { ok: bool, msg_id: string }
 */
export async function sendMessage(recipient, content) {
  const { data } = await client.post('/send', { recipient, content })
  return data
}

/**
 * Broadcast a message to a group.
 * POST /group/send  { group_id: string, members: string[], content: string }
 * Returns: { ok: bool, delivered: Record<string, bool> }
 */
export async function sendGroupMessage(group_id, members, content) {
  const { data } = await client.post('/group/send', { group_id, members, content })
  return data
}

/**
 * Poll messages from / to a specific peer.
 * GET /messages/{peer_id}
 * Returns: MessageResponse[]
 */
export async function getMessages(peer_id) {
  const { data } = await client.get(`/messages/${peer_id}`)
  return data
}
