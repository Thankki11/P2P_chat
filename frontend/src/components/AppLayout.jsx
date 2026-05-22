// AppLayout.jsx — Main layout: left sidebar (PeerList + GroupChat toggle) +
//                 right main area (ChatWindow or GroupChat).
import React, { useState } from 'react'
import PeerList from './PeerList'
import ChatWindow from './ChatWindow'
import GroupChat from './GroupChat'
import Toast from './Toast'

export default function AppLayout() {
  const [selectedPeer, setSelectedPeer] = useState(null)
  const [showGroup, setShowGroup] = useState(false)
  const [toast, setToast] = useState(null)

  // TODO: initialise useWebSocket hook and pass dispatch to child components

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 font-bold text-lg border-b">P2P Chat</div>
        <PeerList
          onSelectPeer={peer => { setSelectedPeer(peer); setShowGroup(false) }}
          selectedPeer={selectedPeer}
        />
        <button
          className="m-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
          onClick={() => { setShowGroup(true); setSelectedPeer(null) }}
        >
          Group Chat
        </button>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col">
        {showGroup
          ? <GroupChat onToast={setToast} />
          : selectedPeer
            ? <ChatWindow peer={selectedPeer} onToast={setToast} />
            : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                Select a peer to start chatting
              </div>
            )
        }
      </main>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
