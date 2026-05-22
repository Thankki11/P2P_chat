// ChatWindow.jsx — 1-to-1 chat: shows message history and a send form for a selected peer.
import React, { useState, useEffect, useRef } from 'react'
import { getMessages, sendMessage } from '../services/api'
import MessageBubble from './MessageBubble'

export default function ChatWindow({ peer, onToast }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  // TODO: poll getMessages(peer.username) and append new messages
  useEffect(() => {
    // TODO: fetch initial messages for this peer
  }, [peer])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim()) return
    // TODO: call sendMessage(peer.username, input), append optimistic bubble
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b font-semibold text-gray-700">
        {peer.username}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Send form */}
      <form onSubmit={handleSend} className="px-6 py-4 border-t flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Message ${peer.username}…`}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          Send
        </button>
      </form>
    </div>
  )
}
