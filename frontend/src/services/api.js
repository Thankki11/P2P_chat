import axios from 'axios'

const client = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
})

function unwrapEnvelope(response) {
  if (response && typeof response === 'object' && 'success' in response) {
    if (!response.success) {
      throw new Error(response.message || 'Request failed')
    }
    return response.data
  }
  return response
}

export async function registerUser(username, port) {
  const { data } = await client.post('/register', { username, port: Number(port) })
  return unwrapEnvelope(data)
}

export async function getPeerList() {
  const { data } = await client.get('/peers')
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
  const params = { limit }
  if (before) params.before = before
  const { data } = await client.get(`/messages/${peer_id}`, { params })
  const payload = unwrapEnvelope(data)
  return Array.isArray(payload) ? payload : []
}

export async function getGroupMessages(group_id, { limit = 50, before } = {}) {
  const params = { limit }
  if (before) params.before = before
  const { data } = await client.get(`/messages/group/${group_id}`, { params })
  const payload = unwrapEnvelope(data)
  return Array.isArray(payload) ? payload : []
}
