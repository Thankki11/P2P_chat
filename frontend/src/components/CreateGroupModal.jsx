// CreateGroupModal.jsx — Modal dialog for creating a group.
//                        Lets the user enter a group name and select peers from the peer list.
import React, { useState } from 'react'
import { getPeerList } from '../services/api'

export default function CreateGroupModal({ onCreate, onCancel }) {
  const [groupId, setGroupId] = useState('')
  const [peers, setPeers] = useState([])          // available peers from API
  const [selected, setSelected] = useState([])    // chosen member usernames

  // TODO: useEffect → getPeerList() to populate `peers`

  function togglePeer(username) {
    setSelected(prev =>
      prev.includes(username)
        ? prev.filter(u => u !== username)
        : [...prev, username]
    )
  }

  function handleCreate() {
    if (!groupId.trim() || selected.length === 0) return
    onCreate({ id: groupId.trim(), members: selected })
  }

  return (
    <div className="flex items-center justify-center flex-1 bg-black/30">
      <div className="bg-white rounded-xl shadow-lg p-6 w-80 space-y-4">
        <h2 className="text-lg font-bold">Create Group</h2>

        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Group name"
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
        />

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {peers.length === 0 && <p className="text-sm text-gray-400">No peers available</p>}
          {peers.map(p => (
            <label key={p.username} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(p.username)}
                onChange={() => togglePeer(p.username)}
              />
              <span className="text-sm">{p.username}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-500 text-white hover:bg-indigo-600"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
