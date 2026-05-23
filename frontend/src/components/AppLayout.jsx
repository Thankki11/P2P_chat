import React, { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import PeerList from './PeerList'
import ChatWindow from './ChatWindow'
import GroupChat from './GroupChat'
import CreateGroupModal from './CreateGroupModal'
import Toast from './Toast'
import { useWebSocket } from '../hooks/useWebSocket'

function loadGroups() {
  try {
    return JSON.parse(localStorage.getItem('groups') || '[]')
  } catch {
    return []
  }
}

export default function AppLayout() {
  const currentUserId = localStorage.getItem('peer_id')
  const username = localStorage.getItem('username')
  const [selectedPeer, setSelectedPeer] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groups, setGroups] = useState(loadGroups)
  const [peers, setPeers] = useState([])
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [toast, setToast] = useState(null)
  const [messageEvent, setMessageEvent] = useState(null)

  useEffect(() => {
    localStorage.setItem('groups', JSON.stringify(groups))
  }, [groups])

  const handleWsMessage = useCallback((data) => {
    if (!data || typeof data !== 'object') return
    if (data.type === 'NEW_MESSAGE' || data.type === 'STORE_FWD_RECV') {
      setMessageEvent({ ...data, _tick: Date.now() })
    }
  }, [])

  useWebSocket(currentUserId, handleWsMessage)

  if (!currentUserId) {
    return <Navigate to="/" replace />
  }

  function handleCreateGroup(group) {
    setGroups(prev => {
      const next = [...prev.filter(item => item.group_id !== group.group_id), group]
      return next
    })
    setSelectedGroup(group)
    setSelectedPeer(null)
    setShowCreateGroup(false)
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <h1 className="text-lg font-semibold">P2P Chat</h1>
          <p className="mt-1 truncate text-xs text-slate-500">
            {username} - {currentUserId}
          </p>
        </div>

        <PeerList
          currentUserId={currentUserId}
          selectedPeer={selectedPeer}
          onSelectPeer={peer => {
            setSelectedPeer(peer)
            setSelectedGroup(null)
          }}
          onPeersChange={setPeers}
        />

        <div className="border-t border-slate-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Groups</p>
            <button
              type="button"
              onClick={() => setShowCreateGroup(true)}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Tao nhom
            </button>
          </div>

          <div className="max-h-40 space-y-1 overflow-y-auto">
            {groups.length === 0 && <p className="py-2 text-sm text-slate-400">Chua co nhom</p>}
            {groups.map(group => (
              <button
                key={group.group_id}
                type="button"
                onClick={() => {
                  setSelectedGroup(group)
                  setSelectedPeer(null)
                }}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                  selectedGroup?.group_id === group.group_id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                }`}
              >
                <p className="truncate font-medium">{group.name}</p>
                <p className="text-xs text-slate-400">{group.member_ids.length} thanh vien</p>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {selectedGroup ? (
          <GroupChat
            group={selectedGroup}
            currentUserId={currentUserId}
            peers={peers}
            onToast={setToast}
            messageEvent={messageEvent}
          />
        ) : selectedPeer ? (
          <ChatWindow
            peer={selectedPeer}
            currentUserId={currentUserId}
            onToast={setToast}
            messageEvent={messageEvent}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Chon mot peer hoac tao nhom de bat dau tro chuyen
          </div>
        )}
      </main>

      {showCreateGroup && (
        <CreateGroupModal
          peers={peers}
          onCreate={handleCreateGroup}
          onCancel={() => setShowCreateGroup(false)}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
