// LoginPage.jsx — Login form: collects username + serverHost, calls POST /register,
//                 then navigates to /chat on success.
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { registerUser } from '../services/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [serverHost, setServerHost] = useState('localhost:9000')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    // TODO: call registerUser(username, serverHost), navigate('/chat') on success
    setError(null)
    try {
      await registerUser(username, serverHost)
      navigate('/chat')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">P2P Chat</h1>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="alice"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Bootstrap Server</label>
          <input
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={serverHost}
            onChange={e => setServerHost(e.target.value)}
            placeholder="localhost:9000"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition"
        >
          Join Network
        </button>
      </form>
    </div>
  )
}
