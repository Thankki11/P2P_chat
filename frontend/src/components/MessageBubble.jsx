import React from 'react'

function formatTime(timestamp) {
  if (!timestamp) return ''
  const value = typeof timestamp === 'number' && timestamp < 1000000000000
    ? timestamp * 1000
    : timestamp
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message, currentUserId, showSender = false }) {
  const isOwn = message.from_id === currentUserId || message.isOwn === true
  const time = formatTime(message.timestamp)

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2 text-sm shadow-sm ${
          isOwn
            ? 'bg-blue-600 text-white'
            : 'border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {showSender && !isOwn && (
          <p className="mb-1 text-xs font-semibold text-slate-500">
            {message.from_username || message.from_id || 'Peer'}
          </p>
        )}
        <p className="break-words leading-relaxed">{message.content}</p>
        <div
          className={`mt-1 flex items-center justify-end gap-2 text-[11px] ${
            isOwn ? 'text-blue-100' : 'text-slate-400'
          }`}
        >
          {message.delivered === false && <span>queued</span>}
          {time && <span>{time}</span>}
        </div>
      </div>
    </div>
  )
}
