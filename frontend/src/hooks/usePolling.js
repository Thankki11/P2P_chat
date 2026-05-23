// usePolling.js — Generic polling hook.
//                 Calls `fetchFn` every `interval` ms and stores the result in state.
//                 Cleans up the interval on unmount or when dependencies change.
import { useState, useEffect, useRef } from 'react'

export function usePolling(fetchFn, interval = 5000) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const fetchRef = useRef(fetchFn)

  useEffect(() => { fetchRef.current = fetchFn }, [fetchFn])

  useEffect(() => {
    let active = true

    async function tick() {
      try {
        const result = await fetchRef.current()
        if (active) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (active) setError(err)
      }
    }

    tick()  // initial call immediately
    const id = setInterval(tick, interval)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [interval])

  return { data, error }
}
