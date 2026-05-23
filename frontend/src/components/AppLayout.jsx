import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import PeerList from './PeerList'
import ChatWindow from './ChatWindow'
import GroupChat from './GroupChat'
import CreateGroupModal from './CreateGroupModal'
import Toast from './Toast'
import { useWebSocket } from '../hooks/useWebSocket'
import { createGroup, logoutUser } from '../services/api'
import { applyTheme, getStoredTheme } from '../services/theme'

const GROUPS_STORAGE_KEY = 'groups'

function currentGroupsStorageKey() {
  return `${GROUPS_STORAGE_KEY}:${localStorage.getItem('username') || 'anonymous'}`
}

function loadGroups() {
  try {
    localStorage.removeItem(GROUPS_STORAGE_KEY)
    return JSON.parse(localStorage.getItem(currentGroupsStorageKey()) || '[]')
  } catch {
    return []
  }
}

function loadDarkMode() {
  return getStoredTheme() === 'dark'
}

function preview(content = '') {
  return content.length > 30 ? `${content.slice(0, 30)}...` : content
}

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

export default function AppLayout() {
  const currentUserId = localStorage.getItem('peer_id')
  const username = localStorage.getItem('username')
  const [selectedPeer, setSelectedPeer] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groups, setGroups] = useState(loadGroups)
  const [peers, setPeers] = useState([])
  const [peerStatusById, setPeerStatusById] = useState({})
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [toasts, setToasts] = useState([])
  const [unreadByPeer, setUnreadByPeer] = useState({})
  const [messageEvent, setMessageEvent] = useState(null)
  const [deliveryEvent, setDeliveryEvent] = useState(null)
  const [darkMode, setDarkMode] = useState(loadDarkMode)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'unread' | 'groups'

  function handleLogout() {
    logoutUser(currentUserId).finally(() => {
      localStorage.removeItem('peer_id')
      localStorage.removeItem('username')
      localStorage.removeItem('peer_port')
      localStorage.removeItem(GROUPS_STORAGE_KEY)
      window.location.href = '/'
    })
  }

  useEffect(() => {
    localStorage.removeItem(GROUPS_STORAGE_KEY)
    localStorage.setItem(currentGroupsStorageKey(), JSON.stringify(groups))
  }, [groups])

  useEffect(() => {
    applyTheme(darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    if (!currentUserId) return

    function notifyLogout() {
      logoutUser(currentUserId)
    }

    window.addEventListener('pagehide', notifyLogout)
    window.addEventListener('beforeunload', notifyLogout)
    return () => {
      window.removeEventListener('pagehide', notifyLogout)
      window.removeEventListener('beforeunload', notifyLogout)
    }
  }, [currentUserId])

  const peerNameById = useMemo(() => {
    return peers.reduce((acc, peer) => {
      acc[peer.peer_id] = peer.username
      return acc
    }, {})
  }, [peers])

  const peerIdByName = useMemo(() => {
    return peers.reduce((acc, peer) => {
      acc[peer.username] = peer.peer_id
      return acc
    }, {})
  }, [peers])

  useEffect(() => {
    if (peers.length === 0) return

    setGroups(prev => {
      let changed = false
      const next = prev.map(group => {
        if (!Array.isArray(group.member_usernames) || group.member_usernames.length === 0) {
          return group
        }

        const memberIds = group.member_usernames
          .map(memberName => peerIdByName[memberName])
          .filter(Boolean)

        if (
          memberIds.length !== group.member_ids.length ||
          memberIds.some((id, index) => id !== group.member_ids[index])
        ) {
          changed = true
          return { ...group, member_ids: memberIds }
        }

        return group
      })

      return changed ? next : prev
    })
  }, [peerIdByName, peers.length])

  const activeSelectedPeer = useMemo(() => {
    if (!selectedPeer) return null
    return peers.find(peer => peer.peer_id === selectedPeer.peer_id) || {
      ...selectedPeer,
      ...(peerStatusById[selectedPeer.peer_id] || {}),
    }
  }, [peerStatusById, peers, selectedPeer])

  const pushToast = useCallback((toast) => {
    const item = { id: `${Date.now()}-${Math.random()}`, ...toast }
    setToasts(prev => [...prev, item].slice(-4))
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(item => item.id !== id))
  }, [])

  const handleWsMessage = useCallback((data) => {
    if (!data || typeof data !== 'object') return

    if (data.type === 'PEER_STATUS') {
      setPeerStatusById(prev => ({
        ...prev,
        [data.peer_id]: { online: data.online, username: data.username, timestamp: data.timestamp },
      }))
      return
    }

    if (data.type === 'MSG_DELIVERED') {
      setDeliveryEvent({ ...data, _tick: Date.now() })
      return
    }

    if (data.type === 'GROUP_CREATED') {
      const allMemberIds = [data.from_id, ...(data.member_ids || [])]
      const group = {
        group_id: data.group_id,
        name: data.name || data.group_id,
        member_ids: allMemberIds.filter(id => id && id !== currentUserId),
        member_usernames: Array.from(new Set([
          data.from_username,
          ...allMemberIds.map(id => peerNameById[id]),
        ].filter(name => name && name !== username))),
      }

      setGroups(prev => [...prev.filter(item => item.group_id !== group.group_id), group])
      pushToast({
        title: `Ban duoc them vao nhom ${group.name}`,
        message: `${data.from_username || 'Peer'} da tao nhom chat moi.`,
      })
      return
    }

    if (data.type === 'NEW_MESSAGE' || data.type === 'STORE_FWD_RECV') {
      const event = { ...data, _tick: Date.now() }
      setMessageEvent(event)

      if (event.group_id) {
        const allMemberIds = [event.from_id, ...(event.member_ids || [])]
        const group = {
          group_id: event.group_id,
          name: event.name || event.group_id,
          member_ids: allMemberIds.filter(id => id && id !== currentUserId),
          member_usernames: Array.from(new Set([
            event.from_username,
            ...allMemberIds.map(id => peerNameById[id]),
          ].filter(name => name && name !== username))),
        }
        setGroups(prev => prev.some(item => item.group_id === group.group_id)
          ? prev
          : [...prev, group])

        if (selectedGroup?.group_id !== event.group_id) {
          pushToast({
            title: `Tin nhan moi trong nhom ${event.group_id}`,
            message: preview(event.content),
          })
        }
        return
      }

      const peerId = event.from_id === currentUserId ? event.to_id : event.from_id
      if (!peerId || peerId === currentUserId) return

      if (selectedPeer?.peer_id !== peerId) {
        setUnreadByPeer(prev => ({ ...prev, [peerId]: (prev[peerId] || 0) + 1 }))
        pushToast({
          title: `Tin nhan moi tu ${event.from_username || peerNameById[peerId] || 'peer'}`,
          message: preview(event.content),
        })
      }
    }
  }, [currentUserId, peerNameById, pushToast, selectedGroup?.group_id, selectedPeer?.peer_id])

  useWebSocket(currentUserId, handleWsMessage)

  if (!currentUserId) {
    return <Navigate to="/" replace />
  }

  function handleSelectPeer(peer) {
    setSelectedPeer(peer)
    setSelectedGroup(null)
    setSidebarOpen(false)
    setUnreadByPeer(prev => ({ ...prev, [peer.peer_id]: 0 }))
  }

  async function handleCreateGroup(group) {
    const groupWithNames = {
      ...group,
      member_usernames: Array.from(new Set(group.member_ids
        .map(id => peerNameById[id])
        .filter(Boolean))),
    }

    try {
      await createGroup(currentUserId, groupWithNames.group_id, groupWithNames.name, groupWithNames.member_ids)
    } catch (err) {
      pushToast({
        title: 'Nhom da tao local',
        message: 'Backend chua sync group, thanh vien se thay nhom khi nhan tin dau tien.',
      })
    }

    setGroups(prev => [...prev.filter(item => item.group_id !== groupWithNames.group_id), groupWithNames])
    setSelectedGroup(groupWithNames)
    setSelectedPeer(null)
    setShowCreateGroup(false)
    setSidebarOpen(false)
  }

  function handleClearGroups() {
    setGroups([])
    setSelectedGroup(null)
    localStorage.removeItem(GROUPS_STORAGE_KEY)
    localStorage.removeItem(currentGroupsStorageKey())
    pushToast({
      title: 'Da xoa nhom',
      message: 'Tat ca nhom local trong phien hien tai da duoc xoa.',
    })
  }

  const sidebar = (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 transition-colors duration-300">
      <div className="border-b border-slate-200 px-4 py-5 dark:border-slate-800">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
              P2P Network
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          {/* Premium User Card */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 dark:bg-slate-900 dark:border-slate-800/60">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-tr ${getGradientBg(username)} text-sm font-bold text-white shadow-md shadow-indigo-500/10`}>
              {initials(username)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                {username}
              </p>
              <p className="truncate text-[10px] text-slate-400 font-mono mt-0.5" title={`Port lắng nghe: ${localStorage.getItem('peer_port')}`}>
                Port: {localStorage.getItem('peer_port') || '7001'}
              </p>
            </div>
            
            {/* Quick Actions inside Card */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDarkMode(value => !value)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                title="Đổi chủ đề"
              >
                {darkMode ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.8 1.28A9 9 0 1111.3 6c-.229 0-.455.01-.678.03a7.99 7.99 0 004.94 4.94c.02-.223.03-.449.03-.678z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
                title="Đăng xuất"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Classification Tab Bar giống hệt hình mẫu */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/20">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                activeTab === 'all'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                activeTab === 'unread'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Chưa đọc
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('groups')}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${
                activeTab === 'groups'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Nhóm
            </button>
          </div>
        </div>
      </div>

      {/* Render lists dynamically based on active tab classification */}
      {activeTab === 'all' && (
        <PeerList
          currentUserId={currentUserId}
          selectedPeer={selectedPeer}
          unreadByPeer={unreadByPeer}
          peerStatusById={peerStatusById}
          onSelectPeer={handleSelectPeer}
          onPeersChange={setPeers}
        />
      )}

      {activeTab === 'unread' && (
        <div className="flex-1 flex flex-col min-h-0">
          {Object.values(unreadByPeer).some(count => count > 0) ? (
            <PeerList
              currentUserId={currentUserId}
              selectedPeer={selectedPeer}
              unreadByPeer={unreadByPeer}
              peerStatusById={peerStatusById}
              onSelectPeer={handleSelectPeer}
              onPeersChange={setPeers}
              filterUnreadOnly={true}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500 italic">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-slate-900/40 dark:text-slate-650 mb-3 border border-slate-100 dark:border-slate-800">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xs font-medium">Không có tin nhắn chưa đọc</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="flex-1 flex flex-col p-3 min-h-0">
          <div className="mb-3 px-1 flex items-center justify-between gap-2 shrink-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Group Chats</p>
            {groups.length > 0 && (
              <button
                type="button"
                onClick={handleClearGroups}
                className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-red-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-red-400"
                title="Xoa tat ca nhom local"
              >
                Xoa
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCreateGroup(true)}
              className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/10 hover:from-indigo-700 hover:to-violet-700 active:scale-95 transition-all duration-200"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Tạo nhóm</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {groups.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 italic">Chưa có nhóm nào</p>
            )}
            {groups.map(group => {
              const isSelected = selectedGroup?.group_id === group.group_id;
              return (
                <button
                  key={group.group_id}
                  type="button"
                  onClick={() => {
                    setSelectedGroup(group)
                    setSelectedPeer(null)
                    setSidebarOpen(false)
                  }}
                  className={`w-full flex flex-col items-start rounded-xl px-3 py-3 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-slate-900/60 ${
                    isSelected
                      ? 'bg-indigo-50 border-l-4 border-indigo-600 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'
                      : 'border-l-4 border-transparent text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <p className="truncate font-semibold w-full text-sm">{group.name}</p>
                  <p className={`text-[11px] mt-1 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                    {group.member_ids.length + 1} thành viên
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
      <div className="hidden md:block">{sidebar}</div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-35 md:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative h-full animate-slide-in">{sidebar}</div>
        </div>
      )}

      <main className="min-w-0 flex-1 flex flex-col">
        {/* Mobile Top Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 md:hidden dark:border-slate-800 dark:bg-slate-950/80 transition-colors duration-300">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-base font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
            P2P Network
          </span>
          <button
            type="button"
            onClick={() => setDarkMode(value => !value)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900"
          >
            {darkMode ? (
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.8 1.28A9 9 0 1111.3 6c-.229 0-.455.01-.678.03a7.99 7.99 0 004.94 4.94c.02-.223.03-.449.03-.678z" />
              </svg>
            ) : (
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {selectedGroup ? (
            <GroupChat
              group={selectedGroup}
              currentUserId={currentUserId}
              peers={peers}
              onToast={(message) => pushToast({ title: 'Lỗi hệ thống', message })}
              messageEvent={messageEvent}
              deliveryEvent={deliveryEvent}
            />
          ) : activeSelectedPeer ? (
            <ChatWindow
              peer={activeSelectedPeer}
              currentUserId={currentUserId}
              onToast={(message) => pushToast({ title: 'Lỗi kết nối', message })}
              messageEvent={messageEvent}
              deliveryEvent={deliveryEvent}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-slate-50/50 p-6 text-center dark:bg-slate-950/20">
              <div className="max-w-md rounded-2xl bg-white p-8 border border-slate-100 shadow-xl dark:bg-slate-900/60 dark:border-slate-800/40">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-800 dark:text-slate-100">P2P Chat Room</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Chọn một peer đang hoạt động hoặc tạo nhóm mới để bắt đầu cuộc trò chuyện mã hóa đầu-cuối trực tiếp.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {showCreateGroup && (
        <CreateGroupModal
          peers={peers}
          onCreate={handleCreateGroup}
          onCancel={() => setShowCreateGroup(false)}
        />
      )}

      <div className="fixed right-4 top-4 z-50 space-y-2">
        {toasts.map(item => (
          <Toast key={item.id} toast={item} onDismiss={() => dismissToast(item.id)} />
        ))}
      </div>
    </div>
  )
}
