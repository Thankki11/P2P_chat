const DB_VERSION = 1
let _db = null
let _peerId = null

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function openDB(peerId) {
  if (_db && _peerId === peerId) return Promise.resolve(_db)
  _peerId = peerId
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(`p2p_chat_${peerId}`, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result

      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'msg_id' })
        msgStore.createIndex('by_conversation', 'conversation_key', { unique: false })
        msgStore.createIndex('by_group', 'group_id', { unique: false })
        msgStore.createIndex('by_timestamp', 'timestamp', { unique: false })
      }

      if (!db.objectStoreNames.contains('groups')) {
        db.createObjectStore('groups', { keyPath: 'group_id' })
      }

      if (!db.objectStoreNames.contains('unread')) {
        db.createObjectStore('unread', { keyPath: 'peer_or_group_id' })
      }
    }

    req.onsuccess = (e) => {
      _db = e.target.result
      resolve(_db)
    }

    req.onerror = () => reject(req.error)
  })
}

function getDB() {
  if (!_db) throw new Error('IndexedDB not initialised — call openDB(peerId) first')
  return _db
}

export async function saveMessage(msg) {
  if (!msg || !msg.msg_id) return
  const db = getDB()
  const entry = { ...msg }

  if (entry.from_id && entry.to_id && !entry.group_id) {
    entry.conversation_key = [entry.from_id, entry.to_id].sort().join('|')
  }

  const tx = db.transaction('messages', 'readwrite')
  await idbRequest(tx.objectStore('messages').put(entry))
}

export async function getMessages(myId, peerId, limit = 50) {
  const db = getDB()
  const key = [myId, peerId].sort().join('|')
  const tx = db.transaction('messages', 'readonly')
  const index = tx.objectStore('messages').index('by_conversation')
  const results = await idbRequest(index.getAll(IDBKeyRange.only(key)))
  return results
    .filter(m => !m.group_id)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit)
}

export async function getGroupMessages(groupId, limit = 50) {
  const db = getDB()
  const tx = db.transaction('messages', 'readonly')
  const index = tx.objectStore('messages').index('by_group')
  const results = await idbRequest(index.getAll(IDBKeyRange.only(groupId)))
  return results
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit)
}

export async function deleteMessage(msgId) {
  if (!msgId) return
  const db = getDB()
  const tx = db.transaction('messages', 'readwrite')
  await idbRequest(tx.objectStore('messages').delete(msgId))
}

export async function saveGroup(group) {
  if (!group || !group.group_id) return
  const db = getDB()
  const tx = db.transaction('groups', 'readwrite')
  await idbRequest(tx.objectStore('groups').put(group))
}

export async function getAllGroups() {
  const db = getDB()
  const tx = db.transaction('groups', 'readonly')
  return idbRequest(tx.objectStore('groups').getAll())
}

export async function clearAllGroups() {
  const db = getDB()
  const tx = db.transaction('groups', 'readwrite')
  await idbRequest(tx.objectStore('groups').clear())
}

export async function setUnread(id, count, type) {
  if (!id) return
  const db = getDB()
  const tx = db.transaction('unread', 'readwrite')
  await idbRequest(tx.objectStore('unread').put({ peer_or_group_id: id, count, type }))
}

export async function getAllUnread() {
  const db = getDB()
  const tx = db.transaction('unread', 'readonly')
  return idbRequest(tx.objectStore('unread').getAll())
}

export function deleteDB(peerId) {
  if (_peerId === peerId) {
    _db = null
    _peerId = null
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(`p2p_chat_${peerId}`)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}
