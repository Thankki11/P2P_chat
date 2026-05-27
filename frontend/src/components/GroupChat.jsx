import { useEffect, useRef, useState } from 'react'
import { getGroupMessages, sendGroupMessage, apiErrorMessage } from '../services/api'
import { openDB, saveMessage, getGroupMessages as getGroupMessagesFromDB, deleteMessage } from '../services/db'
import { encryptGroup, safeDecryptGroup } from '../services/crypto'
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

export default function GroupChat({ group, currentUserId, peers = [], onToast, messageEvent, deliveryEvent, myPrivateJwk, mySelfKey, peerPubKeyById = {} }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const fetchRef = useRef(null)

  async function decryptGroupMsg(msg) {
    const senderPubJwk = msg.from_id === currentUserId ? null : peerPubKeyById[msg.from_id]
    const plain = await safeDecryptGroup(
      msg.content, currentUserId, myPrivateJwk, senderPubJwk, mySelfKey,
    )
    return plain === msg.content ? msg : { ...msg, content: plain }
  }

  // Cache-first load: show IDB immediately, then sync from API.
  useEffect(() => {
    if (!group?.group_id || !currentUserId) return
    let active = true
    setMessages([])
    setLoading(true)

    async function fetchMessages() {
      try {
        await openDB(currentUserId)

        // 1. Show cached messages instantly
        const cached = await getGroupMessagesFromDB(group.group_id)
        if (active && cached.length > 0) {
          setMessages(cached)
          setLoading(false)
        }

        // 2. Sync from server (decrypt before storing)
        const rawServerMsgs = (await getGroupMessages(group.group_id))
          .filter(m => m.group_id === group.group_id)
        if (!active) return
        const serverMsgs = await Promise.all(rawServerMsgs.map(m => decryptGroupMsg(m)))
        for (const m of serverMsgs) {
          await saveMessage(m)
        }

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

  // WS push: decrypt → save to IDB → update state.
  useEffect(() => {
    if (!messageEvent || !group?.group_id) return
    if (messageEvent.group_id !== group.group_id) return

    decryptGroupMsg(messageEvent).then(decrypted => {
      saveMessage(decrypted)
      setMessages(prev => {
        if (prev.some(m => m.msg_id === decrypted.msg_id)) return prev
        const merged = [...prev, decrypted]
        merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        return merged
      })
    })
  }, [messageEvent, group?.group_id])

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
    if (!content || !group?.group_id || !currentUserId) return

    const optimistic = {
      msg_id: `local-group-${Date.now()}`,
      from_id: currentUserId,
      from_username: localStorage.getItem('username') || 'me',
      group_id: group.group_id,
      content,                  // plaintext stored locally
      timestamp: Math.floor(Date.now() / 1000),
      delivered: false,
    }

    await saveMessage(optimistic)
    setMessages(prev => [...prev, optimistic])
    setInput('')

    // Build member public key map (recipients only, not sender)
    let wireContent = content
    if (myPrivateJwk && mySelfKey) {
      const memberPubKeys = {}
      for (const memberId of group.member_ids) {
        const pubJwk = peerPubKeyById[memberId]
        if (pubJwk) memberPubKeys[memberId] = pubJwk
      }
      if (Object.keys(memberPubKeys).length > 0) {
        wireContent = await encryptGroup(content, currentUserId, myPrivateJwk, mySelfKey, memberPubKeys)
      }
    }

    try {
      const result = await sendGroupMessage(currentUserId, group.group_id, group.member_ids, wireContent)
      const resolved = {
        ...optimistic,
        msg_id: result.msg_id || optimistic.msg_id,
        timestamp: result.timestamp || optimistic.timestamp,
        delivered: (result.failed || []).length === 0,
        queued_for: result.queued_for || [],
      }
      await saveMessage(resolved)
      if (result.msg_id && result.msg_id !== optimistic.msg_id) await deleteMessage(optimistic.msg_id)
      setMessages(prev => prev.map(msg => msg.msg_id === optimistic.msg_id ? resolved : msg))
    } catch (err) {
      onToast?.(apiErrorMessage(err))
      await deleteMessage(optimistic.msg_id)
      setMessages(prev => prev.filter(m => m.msg_id !== optimistic.msg_id))
    }
  }

  const members = group.member_ids
    .map(id => peers.find(peer => peer.peer_id === id)?.username || id)
    .join(', ')

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 py-3.5 dark:border-slate-800 dark:bg-slate-950/80 sticky top-0 z-20 flex items-center justify-between transition-colors duration-300">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className={`grid h-10 w-10 place-items-center rounded-full bg-gradient-to-tr ${getGradientBg(group.name)} text-sm font-bold text-white shadow-sm`}>
              {initials(group.name)}
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-850 dark:text-slate-100 leading-tight truncate max-w-[200px] sm:max-w-md">{group.name}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[250px] sm:max-w-xl">
              Thành viên: {members}
            </p>
          </div>
        </div>

        {/* Group label */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>P2P Group Chat</span>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/50 dark:bg-slate-950/20 relative">
        {loading && (
          <div className="space-y-4">
            <div className="flex justify-start">
              <div className="h-12 w-60 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="flex justify-end">
              <div className="h-12 w-52 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center p-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="mt-3 text-sm text-slate-400 dark:text-slate-500 italic">
              Chưa có tin nhắn nào trong nhóm. Hãy gửi tin nhắn đầu tiên!
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
          className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-500"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Nhắn tin cho nhóm ${group.name}...`}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 hover:from-indigo-700 hover:to-violet-700 hover:scale-105 active:scale-95 transition-all duration-200 disabled:cursor-not-allowed disabled:from-indigo-300 disabled:to-indigo-300 disabled:shadow-none"
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
