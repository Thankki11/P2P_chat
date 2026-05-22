// Toast.jsx — Notification toast that appears top-right and auto-dismisses after 3 s.
import React, { useEffect } from 'react'

export default function Toast({ message, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-5 py-3 rounded-xl shadow-lg text-sm animate-fade-in">
      {message}
    </div>
  )
}
