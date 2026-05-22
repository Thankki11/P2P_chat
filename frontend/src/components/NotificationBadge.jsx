// NotificationBadge.jsx — Small red badge showing unread message count on a peer avatar.
//                          Hidden when count is 0.
import React from 'react'

export default function NotificationBadge({ count }) {
  if (!count || count === 0) return null

  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
      {count > 99 ? '99+' : count}
    </span>
  )
}
