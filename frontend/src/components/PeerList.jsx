import React, { useEffect, useMemo } from 'react'
import { usePolling } from '../hooks/usePolling'
import { getPeerList } from '../services/api'
import { mockPeers } from '../services/mockData'
import NotificationBadge from './NotificationBadge'

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

export default function PeerList({
  currentUserId,
  selectedPeer,
  unreadByPeer = {},
  peerStatusById = {},
  onSelectPeer,
  onPeersChange,
  filterUnreadOnly = false,
}) {
  const { data, error } = usePolling(getPeerList, 5000)
  const peers = useMemo(() => {
    let list = (data || (error ? mockPeers : []))
      .filter(peer => peer.peer_id !== currentUserId)
      .map(peer => ({ ...peer, ...(peerStatusById[peer.peer_id] || {}) }))
    
    if (filterUnreadOnly) {
      list = list.filter(peer => (unreadByPeer[peer.peer_id] || 0) > 0)
    }

    return list.sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username))
  }, [currentUserId, data, error, peerStatusById, filterUnreadOnly, unreadByPeer])

  useEffect(() => {
    onPeersChange?.(peers)
  }, [onPeersChange, peers])

  return (
    <div className="flex-1 overflow-y-auto px-2 py-3">
      <div className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Peers online
      </div>

      {peers.length === 0 && (
        <div className="px-3 py-6 text-sm text-slate-400 dark:text-slate-500 italic">
          Không có peer nào hoạt động
        </div>
      )}

      <div className="space-y-0.5">
        {peers.map(peer => {
          const selected = selectedPeer?.peer_id === peer.peer_id
          return (
            <button
              key={peer.peer_id}
              onClick={() => onSelectPeer(peer)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition duration-200 hover:bg-slate-50 dark:hover:bg-slate-900/60 ${
                selected
                  ? 'bg-blue-50/70 border-l-4 border-blue-600 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200'
                  : 'border-l-4 border-transparent text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="relative shrink-0">
                <div className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-tr ${getGradientBg(peer.username)} text-xs font-bold text-white shadow-sm`}>
                  {initials(peer.username)}
                </div>
                {peer.online ? (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-slate-950">
                    <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
                  </span>
                ) : (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-slate-400 dark:border-slate-950" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{peer.username}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{peer.online ? 'online' : 'offline'}</p>
              </div>
              <NotificationBadge count={unreadByPeer[peer.peer_id] || 0} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
