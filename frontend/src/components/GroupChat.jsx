import { useEffect, useRef, useState } from 'react'
import { getGroupMessages, sendGroupMessage, apiErrorMessage } from '../services/api'
import MessageBubble from './MessageBubble'

export default function GroupChat({ group, currentUserId, peers = [], onToast, messageEvent }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const fetchRef = useRef(null)

  useEffect(() => {
    if (!group?.group_id || !currentUserId) return
    let active = true
    setMessages([])
    setLoading(true)

    async function fetchMessages() {
      try {
        const serverMsgs = await getGroupMessages(group.group_id)
        if (!active) return

        setMessages(prev => {
          const serverIds = new Set(serverMsgs.map(m => m.msg_id))
          const stillPending = prev.filter(
            m => m.msg_id?.startsWith('local-group-') && !serverIds.has(m.msg_id),
          )
          const merged = [...serverMsgs, ...stillPending]
          merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          return merged
        })
      } catch (err) {
        console.warn('[GroupChat] fetch error:', apiErrorMessage(err))
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchRef.current = fetchMessages
    fetchMessages()

    return () => {
      active = false
    }
  }, [currentUserId, group?.group_id])

  // WS push trigger — refetch when a group message for this group arrives.
  useEffect(() => {
    if (!messageEvent || !group?.group_id) return
    if (messageEvent.group_id === group.group_id) fetchRef.current?.()
  }, [messageEvent, group?.group_id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const content = input.trim()
    if (!content || !group?.group_id || !currentUserId) return

    const optimistic = {
      msg_id: `local-group-${Date.now()}`,
      from_id: currentUserId,
      from_username: localStorage.getItem('username') || 'me',
      group_id: group.group_id,
      content,
      timestamp: Math.floor(Date.now() / 1000),
      delivered: false,
    }

    setMessages(prev => [...prev, optimistic])
    setInput('')

    try {
      const result = await sendGroupMessage(currentUserId, group.group_id, group.member_ids, content)
      setMessages(prev =>
        prev.map(msg =>
          msg.msg_id === optimistic.msg_id
            ? {
                ...msg,
                msg_id: result.msg_id || msg.msg_id,
                timestamp: result.timestamp || msg.timestamp,
                delivered: (result.failed || []).length === 0,
                queued_for: result.queued_for || [],
              }
            : msg,
        ),
      )
    } catch (err) {
      onToast?.(apiErrorMessage(err))
      setMessages(prev => prev.filter(m => m.msg_id !== optimistic.msg_id))
    }
  }

  const members = group.member_ids
    .map(id => peers.find(peer => peer.peer_id === id)?.username || id)
    .join(', ')

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h2 className="font-semibold text-slate-900">{group.name}</h2>
        <p className="mt-1 truncate text-xs text-slate-500">{members}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="space-y-3">
            <div className="h-12 w-60 animate-pulse rounded-lg bg-slate-200" />
            <div className="ml-auto h-12 w-52 animate-pulse rounded-lg bg-slate-200" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Chua co tin nhan nao trong nhom
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
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 bg-white px-6 py-4">
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Message ${group.name}`}
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Gui
        </button>
      </form>
    </div>
  )
}
