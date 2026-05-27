import React, { useMemo, useState } from 'react'

function initials(username = '') {
  return username
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?'
}

function getGradientBg(username = '') {
  const gradients = [
    'from-pink-500 to-rose-500',
    'from-purple-500 to-indigo-500',
    'from-blue-500 to-teal-500',
    'from-green-500 to-emerald-500',
    'from-amber-500 to-orange-500',
    'from-fuchsia-500 to-pink-600',
  ]
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % gradients.length
  return gradients[index]
}

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur-xl dark:border-slate-800/40 dark:bg-slate-950/95 transition-all duration-300">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-850 dark:text-slate-100">Tạo nhóm chat mới</h2>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Nhập tên nhóm và chọn các thành viên muốn tham gia kết nối P2P.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400" htmlFor="group-name">
              Tên nhóm chat
            </label>
            <input
              id="group-name"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-indigo-500"
              placeholder="Ví dụ: Nhóm Dự Án, Đồng Nghiệp..."
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400" htmlFor="peer-search">
              Tìm thành viên ({selected.length} đã chọn)
            </label>
            <div className="relative mt-1.5">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                id="peer-search"
                className="w-full rounded-xl border border-slate-200 bg-white/70 py-2.5 pl-9 pr-4 text-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100 dark:focus:border-indigo-500"
                placeholder="Nhập tên người dùng cần tìm..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200/60 p-2 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-900/20">
          {filteredPeers.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-slate-400 dark:text-slate-500 italic">
              Không tìm thấy thành viên nào phù hợp
            </p>
          )}

          {filteredPeers.map(peer => {
            const isChecked = selected.includes(peer.peer_id);
            return (
              <label
                key={peer.peer_id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-all duration-150 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 ${
                  isChecked ? 'bg-indigo-50/40 dark:bg-indigo-950/10' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-950 dark:checked:bg-indigo-600"
                  checked={isChecked}
                  onChange={() => togglePeer(peer.peer_id)}
                />
                
                <div className="relative shrink-0">
                  <div className={`grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr ${getGradientBg(peer.username)} text-[10px] font-bold text-white shadow-sm`}>
                    {initials(peer.username)}
                  </div>
                  {peer.online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500 dark:border-slate-950">
                      <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
                    </span>
                  )}
                </div>

                <span className="min-w-0 flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                  {peer.username}
                </span>
                
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  peer.online
                    ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                    : 'bg-slate-150 text-slate-400 dark:bg-slate-900 dark:text-slate-500'
                }`}>
                  {peer.online ? 'online' : 'offline'}
                </span>
              </label>
            )
          })}
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || selected.length === 0}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/10 hover:from-indigo-700 hover:to-violet-700 active:scale-95 transition-all duration-200 disabled:cursor-not-allowed disabled:from-indigo-300 disabled:to-indigo-300 disabled:shadow-none"
          >
            Tạo nhóm
          </button>
        </div>
      </div>
    </div>
  )
}
