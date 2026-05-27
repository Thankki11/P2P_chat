import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiErrorMessage, registerUser } from '../services/api'
import { applyTheme, getStoredTheme } from '../services/theme'
import { generateKeyPair, generateSelfKey } from '../services/crypto'

const MAX_PORT_RETRIES = 20

function isPortInUseError(err) {
  const message = apiErrorMessage(err).toLowerCase()
  return (
    err.response?.status === 409 ||
    message.includes('address already in use') ||
    message.includes('already in use') ||
    message.includes('winerror 10048') ||
    message.includes('only one usage') ||
    (message.includes('port') && (message.includes('busy') || message.includes('used')))
  )
}

export default function LoginPage() {
  const navigate = useNavigate()

  // Attempt to resume previous session: if we have a saved peer_id + username + port,
  // call /register with the old peer_id so the backend recreates the SAME identity.
  // This keeps the IndexedDB (keyed by peer_id) usable across browser restarts.
  useEffect(() => {
    const savedPeerId = localStorage.getItem('peer_id')
    const savedUsername = localStorage.getItem('username')
    const savedPort = localStorage.getItem('peer_port')
    const savedPubKey = localStorage.getItem('crypto_public_jwk')

    if (!savedPeerId || !savedUsername || !savedPort) return

    let cancelled = false
    setSubmitting(true)
    ;(async () => {
      try {
        const data = await registerUser(
          savedUsername,
          Number(savedPort),
          savedPubKey || '',
          savedPeerId,
        )
        if (cancelled) return
        localStorage.setItem('peer_id', data.peer_id)
        localStorage.setItem('username', data.username || savedUsername)
        navigate('/chat', { replace: true })
      } catch (err) {
        if (cancelled) return
        // Resume failed — clear stale peer_id but keep username/port for convenience
        console.warn('[LoginPage] resume failed:', apiErrorMessage(err))
        localStorage.removeItem('peer_id')
        setUsername(savedUsername)
        setPort(String(savedPort))
        setNotice('Phiên cũ đã hết hạn. Bấm Tham gia để đăng nhập lại.')
        setSubmitting(false)
      }
    })()

    return () => { cancelled = true }
  }, [navigate])

  const [username, setUsername] = useState('')
  const [port, setPort] = useState('7001')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [theme, setTheme] = useState(getStoredTheme)

  function toggleTheme() {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const cleanUsername = username.trim()
    const numericPort = Number(port)

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setError('Username phai tu 3 den 20 ky tu.')
      return
    }

    if (!Number.isInteger(numericPort) || numericPort < 1024 || numericPort > 65535) {
      setError('Port phai nam trong khoang 1024-65535.')
      return
    }

    try {
      setSubmitting(true)

      // Generate ECDH key pair + self-seal key before registering
      const [{ publicJwk, privateJwk }, selfKeyB64] = await Promise.all([
        generateKeyPair(),
        generateSelfKey(),
      ])
      const publicKeyStr = JSON.stringify(publicJwk)

      let selectedPort = numericPort
      let data = null

      for (let attempt = 0; attempt < MAX_PORT_RETRIES; attempt += 1) {
        try {
          data = await registerUser(cleanUsername, selectedPort, publicKeyStr)
          break
        } catch (err) {
          if (!isPortInUseError(err) || selectedPort >= 65535) {
            throw err
          }
          selectedPort += 1
        }
      }

      if (!data) {
        throw new Error(`Khong tim duoc port trong tu ${numericPort} den ${numericPort + MAX_PORT_RETRIES - 1}.`)
      }

      localStorage.removeItem('groups')
      localStorage.setItem('peer_id', data.peer_id)
      localStorage.setItem('username', data.username || cleanUsername)
      localStorage.setItem('peer_port', String(selectedPort))
      localStorage.setItem('crypto_private_jwk', JSON.stringify(privateJwk))
      localStorage.setItem('crypto_public_jwk', publicKeyStr)
      localStorage.setItem('crypto_self_key', selfKeyB64)

      if (selectedPort !== numericPort) {
        setPort(String(selectedPort))
        setNotice(`Port ${numericPort} dang duoc su dung. He thong da tu dong doi sang port ${selectedPort}.`)
        window.setTimeout(() => navigate('/chat'), 900)
        return
      }

      navigate('/chat')
    } catch (err) {
      setError(apiErrorMessage(err) || 'Khong dang ky duoc peer.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 px-4 overflow-hidden dark:bg-slate-950 transition-colors duration-300">
      {/* Decorative blurred background blobs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-blue-400/20 dark:bg-blue-600/10 blur-3xl animate-blob-1 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-indigo-400/20 dark:bg-indigo-600/10 blur-3xl animate-blob-2 pointer-events-none" />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/60 bg-white/80 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 dark:border-slate-800/40 dark:bg-slate-900/70"
      >
        <div className="mb-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
                P2P Chat
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Đăng ký peer để kết nối và trò chuyện tức thì.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white/50 text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:scale-105 active:scale-95 transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              title="Đổi giao diện"
            >
              {theme === 'dark' ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.8 1.28A9 9 0 1111.3 6c-.229 0-.455.01-.678.03a7.99 7.99 0 004.94 4.94c.02-.223.03-.449.03-.678z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm text-red-700 backdrop-blur-md dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
            <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p>{error}</p>
          </div>
        )}

        {notice && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 backdrop-blur-md dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400">
            <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{notice}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400" htmlFor="username">
              Username của bạn
            </label>
            <div className="relative mt-1.5">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <input
                id="username"
                className="w-full rounded-xl border border-slate-200 bg-white/70 py-2.5 pl-10 pr-4 text-sm outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100 dark:focus:border-blue-500"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Ví dụ: alice, bob..."
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400" htmlFor="port">
              Cổng kết nối TCP Port
            </label>
            <div className="relative mt-1.5">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </span>
              <input
                id="port"
                type="number"
                min="1024"
                max="65535"
                className="w-full rounded-xl border border-slate-200 bg-white/70 py-2.5 pl-10 pr-4 text-sm outline-none transition-all duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-100 dark:focus:border-blue-500"
                value={port}
                onChange={e => setPort(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-8 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all duration-200 disabled:cursor-not-allowed disabled:from-blue-400 disabled:to-indigo-400 disabled:shadow-none"
        >
          {submitting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Đang kết nối...</span>
            </>
          ) : (
            <>
              <span>Tham gia mạng P2P</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
