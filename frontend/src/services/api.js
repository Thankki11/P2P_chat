import axios from 'axios'

const client = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

// Extract human-readable message from FastAPI error responses.
// FastAPI HTTPException body: { detail: { message: "..." } } or { detail: "string" }
export function apiErrorMessage(err) {
  const detail = err.response?.data?.detail
  if (detail && typeof detail === 'object') return detail.message || JSON.stringify(detail)
  if (typeof detail === 'string') return detail
  return err.message || 'Unknown error'
}

// Global interceptor: if the server says "peer not registered" it means the
// server was restarted and our session is gone → clear localStorage and reload.
client.interceptors.response.use(
  res => res,
  err => {
    if (apiErrorMessage(err) === 'peer not registered') {
      localStorage.removeItem('peer_id')
      localStorage.removeItem('username')
      localStorage.removeItem('peer_port')
      window.location.replace('/')
    }
    return Promise.reject(err)
  },
)

function unwrapEnvelope(response) {
  if (response && typeof response === 'object' && 'success' in response) {
    if (!response.success) {
      throw new Error(response.message || 'Request failed')
    }
    return response.data
  }
  return response
}

function myPeerId() {
  return localStorage.getItem('peer_id') || ''
}

export async function registerUser(username, port) {
  const { data } = await client.post('/register', { username, port: Number(port) })
  return unwrapEnvelope(data)
}

export async function getPeerList() {
  const { data } = await client.get('/peers', { params: { me: myPeerId() } })
  const payload = unwrapEnvelope(data)
  return Array.isArray(payload) ? payload : payload?.peers ?? []
}

export async function sendMessage(from_id, to_id, content) {
  const { data } = await client.post('/send', { from_id, to_id, content })
  return unwrapEnvelope(data)
}

export async function sendGroupMessage(from_id, group_id, member_ids, content) {
  const { data } = await client.post('/group/send', {
    from_id,
    group_id,
    member_ids,
    content,
  })
  return unwrapEnvelope(data)
}

export async function getMessages(peer_id, { limit = 50, before } = {}) {
  const params = { me: myPeerId(), limit }
  if (before) params.before = before
  const { data } = await client.get(`/messages/${peer_id}`, { params })
  const payload = unwrapEnvelope(data)
  return Array.isArray(payload) ? payload : []
}

export function logoutUser(peer_id) {
  const blob = new Blob([JSON.stringify({ peer_id })], { type: 'application/json' })
  navigator.sendBeacon('http://localhost:8000/logout', blob)
}

export async function getGroupMessages(group_id, { limit = 50, before } = {}) {
  const params = { me: myPeerId(), limit }
  if (before) params.before = before
  const { data } = await client.get(`/messages/group/${group_id}`, { params })
  const payload = unwrapEnvelope(data)
  return Array.isArray(payload) ? payload : []
}
