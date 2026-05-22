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

export default function PeerList({
  currentUserId,
  selectedPeer,
  unreadByPeer = {},
  onSelectPeer,
  onPeersChange,
}) {
  const { data, error } = usePolling(getPeerList, 5000)
  const peers = useMemo(() => {
    return (data || (error ? mockPeers : []))
      .filter(peer => peer.peer_id !== currentUserId)
      .sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username))
  }, [currentUserId, data, error])

  useEffect(() => {
    onPeersChange?.(peers)
  }, [onPeersChange, peers])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Peers
      </div>

      {peers.length === 0 && (
        <div className="px-4 py-6 text-sm text-slate-400">
          Khong co peer nao online
        </div>
      )}

      {peers.map(peer => {
        const selected = selectedPeer?.peer_id === peer.peer_id
        return (
          <button
            key={peer.peer_id}
            onClick={() => onSelectPeer(peer)}
            className={`w-full border-l-4 px-4 py-3 text-left transition hover:bg-slate-50 ${
              selected ? 'border-blue-600 bg-blue-50' : 'border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                {initials(peer.username)}
                <span
                  className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                    peer.online ? 'bg-green-500' : 'bg-slate-400'
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{peer.username}</p>
                <p className="text-xs text-slate-400">{peer.online ? 'online' : 'offline'}</p>
              </div>
              <NotificationBadge count={unreadByPeer[peer.peer_id] || 0} />
            </div>
          </button>
        )
      })}
    </div>
  )
}
