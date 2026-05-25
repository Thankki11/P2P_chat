import { useEffect, useRef, useState } from 'react'
import { getMessages, sendMessage, apiErrorMessage } from '../services/api'
import { openDB, saveMessage, getMessages as getMessagesFromDB, deleteMessage } from '../services/db'
import MessageBubble from './MessageBubble'

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

export default function ChatWindow({ peer, currentUserId, onToast, messageEvent, deliveryEvent }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const fetchRef = useRef(null)

  // Cache-first load: show IDB immediately, then sync from API.
  useEffect(() => {
    if (!peer?.peer_id || !currentUserId) return
    let active = true
    setMessages([])
    setLoading(true)

    async function fetchMessages() {
      try {
        await openDB(currentUserId)

        // 1. Show cached messages instantly
        const cached = await getMessagesFromDB(currentUserId, peer.peer_id)
        if (active && cached.length > 0) {
          setMessages(cached)
          setLoading(false)
        }

        // 2. Sync from server
        const serverMsgs = (await getMessages(peer.peer_id))
          .filter(message => !message.group_id)
        if (!active) return

        // Save any new server messages to IDB
        for (const m of serverMsgs) {
          await saveMessage(m)
        }

        setMessages(prev => {
          const serverIds = new Set(serverMsgs.map(m => m.msg_id))
          const stillPending = prev.filter(
            m => m.msg_id?.startsWith('local-') && !serverIds.has(m.msg_id),
          )
          const merged = [...serverMsgs, ...stillPending]
          merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          return merged
        })
      } catch (err) {
        console.warn('[ChatWindow] fetch error:', apiErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchRef.current = fetchMessages
    fetchMessages()

    return () => {
      active = false
    }
  }, [currentUserId, peer?.peer_id])

  // WS push: save to IDB and update state directly (no extra API call).
  useEffect(() => {
    if (!messageEvent || !peer?.peer_id) return
    if (messageEvent.group_id) return
    const isRelevant =
      (messageEvent.from_id === peer.peer_id && messageEvent.to_id === currentUserId) ||
      (messageEvent.from_id === currentUserId && messageEvent.to_id === peer.peer_id)
    if (!isRelevant) return

    saveMessage(messageEvent)
    setMessages(prev => {
      if (prev.some(m => m.msg_id === messageEvent.msg_id)) return prev
      const merged = [...prev, messageEvent]
      merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      return merged
    })
  }, [messageEvent, peer?.peer_id, currentUserId])

  useEffect(() => {
    if (!deliveryEvent?.msg_id) return
    setMessages(prev =>
      prev.map(message => {
        if (message.msg_id !== deliveryEvent.msg_id) return message
        const updated = { ...message, delivered: true, status: deliveryEvent.status || 'ok' }
        saveMessage(updated)
        return updated
      }),
    )
  }, [deliveryEvent])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const content = input.trim()
    if (!content || !peer?.peer_id || !currentUserId) return

    const tempId = `local-${Date.now()}`
    const optimistic = {
      msg_id: tempId,
      from_id: currentUserId,
      to_id: peer.peer_id,
      content,
      timestamp: Math.floor(Date.now() / 1000),
      delivered: false,
      from_username: localStorage.getItem('username') || 'me',
    }

    await saveMessage(optimistic)
    setMessages(prev => [...prev, optimistic])
    setInput('')

    try {
      const result = await sendMessage(currentUserId, peer.peer_id, content)
      const resolved = {
        ...optimistic,
        msg_id: result.msg_id || tempId,
        delivered: result.delivered ?? result.status === 'ok',
      }
      await saveMessage(resolved)
      if (result.msg_id && result.msg_id !== tempId) await deleteMessage(tempId)
      setMessages(prev =>
        prev.map(m => m.msg_id === tempId ? resolved : m),
      )
    } catch (err) {
      onToast?.(apiErrorMessage(err))
      await deleteMessage(tempId)
      setMessages(prev => prev.filter(m => m.msg_id !== tempId))
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 py-3.5 dark:border-slate-800 dark:bg-slate-950/80 sticky top-0 z-20 flex items-center justify-between transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className={`grid h-10 w-10 place-items-center rounded-full bg-gradient-to-tr ${getGradientBg(peer.username)} text-sm font-bold text-white shadow-sm`}>
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
          <div>
            <h2 className="font-bold text-slate-850 dark:text-slate-100 leading-tight">{peer.username}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{peer.online ? 'đang hoạt động' : 'ngoại tuyến'}</p>
          </div>
        </div>

        {/* Secure connection indicator */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>P2P Direct Connection</span>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/50 dark:bg-slate-950/20 relative">
        {loading && (
          <div className="space-y-4">
            <div className="flex justify-start">
              <div className="h-12 w-56 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="flex justify-end">
              <div className="h-12 w-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="flex justify-start">
              <div className="h-12 w-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="mt-3 text-sm text-slate-400 dark:text-slate-500 italic">
              Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!
            </p>
          </div>
        )}

        {!loading && messages.length > 0 && (
          <div className="space-y-3">
            {messages.map(message => (
              <MessageBubble
                key={message.msg_id || `${message.from_id}-${message.timestamp}`}
                message={message}
                currentUserId={currentUserId}
                showSender
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950/90 transition-colors duration-300"
      >
        <input
          className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-500"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Nhắn tin cho ${peer.username}...`}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 hover:scale-105 active:scale-95 transition-all duration-200 disabled:cursor-not-allowed disabled:from-blue-300 disabled:to-indigo-300 disabled:shadow-none"
          title="Gửi"
        >
          <svg className="h-5 w-5 rotate-45 transform translate-x-[-1px] translate-y-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  )
}
