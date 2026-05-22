// vite.config.js — Vite build config with dev-server proxy to the FastAPI backend.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // REST API calls: /api/... → http://localhost:8000/...
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // WebSocket upgrade: /ws/... → ws://localhost:8000/ws/...
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
