// PeerList.jsx — Sidebar list of known peers with online (green) / offline (gray) status dots.
import React from 'react'
import { usePolling } from '../hooks/usePolling'
import { getPeerList } from '../services/api'
import NotificationBadge from './NotificationBadge'

export default function PeerList({ onSelectPeer, selectedPeer }) {
  // TODO: replace with real data from usePolling
  const peers = []

  // TODO: usePolling(getPeerList, 5000) to refresh peer list every 5 s

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wide">Online Peers</div>
      {peers.length === 0 && (
        <p className="px-4 text-sm text-gray-400">No peers online</p>
      )}
      {peers.map(peer => (
        <button
          key={peer.username}
          onClick={() => onSelectPeer(peer)}
          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition text-left ${
            selectedPeer?.username === peer.username ? 'bg-blue-50' : ''
          }`}
        >
          {/* Status dot */}
          <span className={`w-2.5 h-2.5 rounded-full ${peer.online ? 'bg-green-400' : 'bg-gray-300'}`} />
          <span className="flex-1 text-sm font-medium">{peer.username}</span>
          <NotificationBadge count={peer.unread ?? 0} />
        </button>
      ))}
    </div>
  )
}
