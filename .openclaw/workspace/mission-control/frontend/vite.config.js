import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: true,
    proxy: {
      '/state': 'http://localhost:8765',
      '/docs': 'http://localhost:8765',
      '/conversations': 'http://localhost:8765',
      '/conventions': 'http://localhost:8765',
      '/chat': 'http://localhost:8765',
      '/agent-comms': 'http://localhost:8765',
      '/team-chat': 'http://localhost:8765',
      '/token-status': 'http://localhost:8765',
      '/roadmap': 'http://localhost:8765',
      '/live-activity': 'http://localhost:8765',
      '/task-sync': 'http://localhost:8765',
      '/stripe': 'http://localhost:8765',
      '/stripe-webhook': 'http://localhost:8766',
      '/download': 'http://localhost:8765',
    },
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/state': 'http://localhost:8765',
      '/docs': 'http://localhost:8765',
      '/conversations': 'http://localhost:8765',
      '/conventions': 'http://localhost:8765',
      '/chat': 'http://localhost:8765',
      '/agent-comms': 'http://localhost:8765',
      '/team-chat': 'http://localhost:8765',
      '/token-status': 'http://localhost:8765',
      '/roadmap': 'http://localhost:8765',
      '/live-activity': 'http://localhost:8765',
      '/task-sync': 'http://localhost:8765',
      '/stripe': 'http://localhost:8765',
      '/stripe-webhook': 'http://localhost:8766',
      '/download': 'http://localhost:8765',
    },
  },
})
