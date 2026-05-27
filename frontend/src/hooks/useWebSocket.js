import { useCallback, useEffect, useRef } from 'react'

const BASE_DELAY = 1000
const MAX_DELAY = 30000

export function useWebSocket(userId, onMessage) {
  const wsRef = useRef(null)
  const delayRef = useRef(BASE_DELAY)
  const stopRef = useRef(false)
  const onMessageRef = useRef(onMessage)
  const reconnectRef = useRef(null)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (stopRef.current || !userId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${userId}`)

    ws.onopen = () => {
      delayRef.current = BASE_DELAY
      console.info('[useWebSocket] connected')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.type === 'PING' && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() / 1000 }))
        }
        onMessageRef.current?.(data)
      } catch {
        // Ignore non-JSON keepalive frames.
      }
    }

    ws.onclose = () => {
      if (stopRef.current) return
      const delay = Math.min(delayRef.current * 2, MAX_DELAY)
      console.info(`[useWebSocket] reconnecting in ${delay / 1000}s...`)
      delayRef.current = delay
      reconnectRef.current = setTimeout(connect, delay)
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
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
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
