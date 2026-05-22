// MessageBubble.jsx — Renders a single chat message.
//   Right-aligned (blue) for messages sent by the local user,
//   left-aligned (gray) for messages received from a peer.
import React from 'react'

export default function MessageBubble({ message }) {
  // TODO: determine "isMe" by comparing message.sender to stored local username
  const isMe = message.isMe ?? false

  const time = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs px-4 py-2 rounded-2xl text-sm shadow-sm ${
          isMe
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-white text-gray-800 border rounded-bl-sm'
        }`}
      >
        <p>{message.content}</p>
        <p className={`text-xs mt-1 ${isMe ? 'text-blue-100' : 'text-gray-400'} text-right`}>
          {time}
        </p>
      </div>
    </div>
  )
}
