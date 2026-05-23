import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerUser } from '../services/api'

export default function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('peer_id')) navigate('/chat', { replace: true })
  }, [navigate])

  const [username, setUsername] = useState('')
  const [port, setPort] = useState('7001')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

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
      const data = await registerUser(cleanUsername, numericPort)
      localStorage.setItem('peer_id', data.peer_id)
      localStorage.setItem('username', data.username || cleanUsername)
      localStorage.setItem('peer_port', String(numericPort))
      navigate('/chat')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Khong dang ky duoc peer.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">P2P Chat</h1>
          <p className="mt-1 text-sm text-slate-500">Dang ky peer de bat dau tro chuyen.</p>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <label className="block text-sm font-medium text-slate-700" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="alice"
          required
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="port">
          TCP port
        </label>
        <input
          id="port"
          type="number"
          min="1024"
          max="65535"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          value={port}
          onChange={e => setPort(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {submitting ? 'Dang dang ky...' : 'Join Network'}
        </button>
      </form>
    </div>
  )
}
