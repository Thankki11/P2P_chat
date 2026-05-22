// useWebSocket.js — Custom hook that opens a WebSocket to ws://localhost:8000/ws/{userId},
//                   dispatches incoming messages, and auto-reconnects with exponential backoff.
import { useEffect, useRef, useCallback } from 'react'

const BASE_DELAY = 1000   // ms — initial reconnect delay
const MAX_DELAY  = 30000  // ms — cap on reconnect delay

export function useWebSocket(userId, onMessage) {
  const wsRef      = useRef(null)
  const delayRef   = useRef(BASE_DELAY)
  const stopRef    = useRef(false)

  const connect = useCallback(() => {
    if (stopRef.current || !userId) return

    // TODO: open WebSocket to ws://localhost:8000/ws/{userId}
    //   ws.onopen    → reset delayRef to BASE_DELAY
    //   ws.onmessage → parse JSON, call onMessage(parsed)
    //   ws.onclose   → schedule reconnect via setTimeout(connect, delayRef * 2)
    //   ws.onerror   → log error
    const ws = new WebSocket(`ws://localhost:8000/ws/${userId}`)

    ws.onopen = () => {
      delayRef.current = BASE_DELAY
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage?.(data)
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
      console.error('[useWebSocket] error', err)
    }

    wsRef.current = ws
  }, [userId, onMessage])

  useEffect(() => {
    stopRef.current = false
    connect()
    return () => {
      stopRef.current = true
      wsRef.current?.close()
    }
  }, [connect])

  const send = useCallback((data) => {
    // TODO: send JSON string over the open socket (check readyState first)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
