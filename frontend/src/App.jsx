// App.jsx — Root router: "/" → LoginPage, "/chat" → AppLayout.
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './components/LoginPage'
import AppLayout from './components/AppLayout'

export default function App() {
  // TODO: add auth context / protected route wrapper
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/chat" element={<AppLayout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
