import React, { useEffect } from 'react'

export default function Toast({ toast, message, onDismiss }) {
  const data = typeof toast === 'object' && toast !== null ? toast : { message }

  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [data.id, onDismiss])

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/50 bg-white/90 p-4 text-sm text-slate-800 shadow-xl backdrop-blur-md dark:border-slate-800/40 dark:bg-slate-900/90 dark:text-slate-100 transition-all duration-300 animate-slide-in">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-650 dark:bg-blue-950/40 dark:text-blue-400">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-850 dark:text-slate-100">{data.title || 'Thông báo P2P'}</p>
        {data.message && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words">{data.message}</p>}
      </div>
      <button
        onClick={onDismiss}
        className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        title="Đóng"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
