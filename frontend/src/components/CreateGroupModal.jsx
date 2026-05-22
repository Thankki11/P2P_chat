import React, { useMemo, useState } from 'react'

export default function CreateGroupModal({ peers = [], onCreate, onCancel }) {
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])

  const filteredPeers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return peers
    return peers.filter(peer => peer.username.toLowerCase().includes(needle))
  }, [peers, query])

  function togglePeer(peerId) {
    setSelected(prev =>
      prev.includes(peerId)
        ? prev.filter(id => id !== peerId)
        : [...prev, peerId],
    )
  }

  function handleCreate() {
    const cleanName = name.trim()
    if (!cleanName || selected.length === 0) return
    const group = {
      group_id: cleanName.toLowerCase().replace(/\s+/g, '-'),
      name: cleanName,
      member_ids: selected,
    }
    onCreate(group)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Tao nhom moi</h2>
          <p className="mt-1 text-sm text-slate-500">Chon thanh vien va dat ten nhom.</p>
        </div>

        <label className="block text-sm font-medium text-slate-700" htmlFor="group-name">
          Ten nhom
        </label>
        <input
          id="group-name"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="Nhom du an P2P"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="peer-search">
          Tim peer
        </label>
        <input
          id="peer-search"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="Nhap username"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className="mt-4 max-h-52 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2">
          {filteredPeers.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-slate-400">Khong co peer phu hop</p>
          )}

          {filteredPeers.map(peer => (
            <label
              key={peer.peer_id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(peer.peer_id)}
                onChange={() => togglePeer(peer.peer_id)}
              />
              <span className="min-w-0 flex-1 text-sm text-slate-800">{peer.username}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${peer.online ? 'bg-green-500' : 'bg-slate-400'}`} />
            </label>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Huy
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || selected.length === 0}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            Tao
          </button>
        </div>
      </div>
    </div>
  )
}
