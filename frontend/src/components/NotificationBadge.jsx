// NotificationBadge.jsx — Small red badge showing unread message count on a peer avatar.
//                          Hidden when count is 0.
import React from 'react'

export default function NotificationBadge({ count }) {
  if (!count || count === 0) return null

  return (
    <span className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white text-[11px] font-black shadow-md shadow-red-500/20 leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}
