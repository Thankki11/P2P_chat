import React, { useEffect, useRef, useState } from 'react'
import { getMessages, sendMessage } from '../services/api'
import { mockMessages } from '../services/mockData'
import MessageBubble from './MessageBubble'

export default function ChatWindow({ peer, currentUserId, onToast }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    let active = true

    async function loadMessages() {
      if (!peer?.peer_id) return
      setLoading(true)
      setError(null)
      try {
        const history = await getMessages(peer.peer_id)
        if (active) setMessages(history)
      } catch (err) {
        const fallback = mockMessages.filter(
          msg =>
            (msg.from_id === currentUserId && msg.to_id === peer.peer_id) ||
            (msg.from_id === peer.peer_id && msg.to_id === currentUserId),
        )
        if (active) {
          setMessages(fallback)
          setError(err.response?.data?.message || err.message)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadMessages()
    return () => {
      active = false
    }
  }, [currentUserId, peer?.peer_id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const content = input.trim()
    if (!content || !peer?.peer_id || !currentUserId) return

    const optimistic = {
      msg_id: `local-${Date.now()}`,
      from_id: currentUserId,
      to_id: peer.peer_id,
      content,
      timestamp: Math.floor(Date.now() / 1000),
      delivered: false,
      from_username: localStorage.getItem('username') || 'me',
    }

    setMessages(prev => [...prev, optimistic])
    setInput('')

    try {
      const result = await sendMessage(currentUserId, peer.peer_id, content)
      setMessages(prev =>
        prev.map(msg =>
          msg.msg_id === optimistic.msg_id
            ? {
                ...msg,
                msg_id: result.msg_id || msg.msg_id,
                timestamp: result.timestamp || msg.timestamp,
                delivered: result.delivered ?? result.status === 'ok',
              }
            : msg,
        ),
      )
    } catch (err) {
      onToast?.(err.response?.data?.message || err.message || 'Khong gui duoc tin nhan')
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${peer.online ? 'bg-green-500' : 'bg-slate-400'}`} />
          <div>
            <h2 className="font-semibold text-slate-900">{peer.username}</h2>
            <p className="text-xs text-slate-500">{peer.online ? 'online' : 'offline'}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="space-y-3">
            <div className="h-12 w-56 animate-pulse rounded-lg bg-slate-200" />
            <div className="ml-auto h-12 w-64 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-12 w-48 animate-pulse rounded-lg bg-slate-200" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Chua co tin nhan nao. Hay bat dau cuoc tro chuyen!
          </div>
        )}

        {!loading && messages.length > 0 && (
          <div className="space-y-2">
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

        {error && (
          <p className="mt-4 text-center text-xs text-amber-600">
            Dang hien thi du lieu mock vi API chua san sang: {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 bg-white px-6 py-4">
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Message ${peer.username}`}
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Gui
        </button>
      </form>
    </div>
  )
}
