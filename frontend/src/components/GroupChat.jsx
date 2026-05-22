// GroupChat.jsx — Group message history and send form.
//                 Also renders the CreateGroupModal when no active group exists.
import React, { useState } from 'react'
import { sendGroupMessage } from '../services/api'
import MessageBubble from './MessageBubble'
import CreateGroupModal from './CreateGroupModal'

export default function GroupChat({ onToast }) {
  const [group, setGroup] = useState(null)       // active group {id, members}
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [showModal, setShowModal] = useState(true)

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || !group) return
    // TODO: call sendGroupMessage(group.id, group.members, input)
    //       append optimistic bubble, clear input
    setInput('')
  }

  function handleGroupCreated(newGroup) {
    setGroup(newGroup)
    setShowModal(false)
  }

  if (showModal || !group) {
    return <CreateGroupModal onCreate={handleGroupCreated} onCancel={() => setShowModal(false)} />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b font-semibold text-gray-700">
        Group: {group.id}
        <span className="ml-2 text-xs text-gray-400">
          ({group.members.join(', ')})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
      </div>

      <form onSubmit={handleSend} className="px-6 py-4 border-t flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Message group…"
        />
        <button
          type="submit"
          className="bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition"
        >
          Send
        </button>
      </form>
    </div>
  )
}
