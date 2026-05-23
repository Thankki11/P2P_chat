// useWebSocket.js — Custom hook that opens a WebSocket to ws://localhost:8000/ws/{userId},
//                   dispatches incoming messages, and auto-reconnects with exponential backoff.
import { useEffect, useRef, useCallback } from 'react'

const BASE_DELAY = 1000   // ms — initial reconnect delay
const MAX_DELAY  = 30000  // ms — cap on reconnect delay

export function useWebSocket(userId, onMessage) {
  const wsRef        = useRef(null)
  const delayRef     = useRef(BASE_DELAY)
  const stopRef      = useRef(false)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (stopRef.current || !userId) return

    const ws = new WebSocket(`ws://localhost:8000/ws/${userId}`)

    ws.onopen = () => {
      delayRef.current = BASE_DELAY
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current?.(data)
      } catch {
        // non-JSON frame — ignore
      }
    }

    ws.onclose = () => {
      if (stopRef.current) return
      const delay = Math.min(delayRef.current * 2, MAX_DELAY)
      delayRef.current = delay
      setTimeout(connect, delay)
    }

    ws.onerror = (err) => {
      console.warn('[useWebSocket] error', err)
    }

    wsRef.current = ws
  }, [userId])

  useEffect(() => {
    stopRef.current = false
    connect()
    return () => {
      stopRef.current = true
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
