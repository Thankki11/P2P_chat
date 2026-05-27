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
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} w-full animate-fade-in`}>
      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {showSender && !isOwn && (
          <span className="mb-1 ml-2 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
            {message.from_username || message.from_id || 'Peer'}
          </span>
        )}
        
        <div
          className={`px-4 py-2.5 text-[13px] md:text-sm shadow-sm transition-all duration-300 leading-relaxed ${
            isOwn
              ? 'rounded-2xl rounded-br-sm bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10'
              : 'rounded-2xl rounded-bl-sm border border-slate-100 bg-white text-slate-800 dark:border-slate-800/60 dark:bg-slate-900 dark:text-slate-100'
          }`}
        >
          <p className="break-words font-medium whitespace-pre-wrap">{message.content}</p>
          
          <div
            className={`mt-1.5 flex items-center justify-end gap-1 text-[9px] font-semibold tracking-wider ${
              isOwn ? 'text-blue-200' : 'text-slate-400'
            }`}
          >
            {time && <span>{time}</span>}
            {isOwn && (
              message.delivered === false ? (
                <span className="flex items-center gap-0.5" title="Đang trong hàng chờ gửi">
                  <svg className="h-2.5 w-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>queued</span>
                </span>
              ) : (
                <svg className="h-3 w-3 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
