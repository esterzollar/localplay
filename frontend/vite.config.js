import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 12955,
    strictPort: true,
    proxy: {
      '/api':   'http://127.0.0.1:12954',
      '/media': 'http://127.0.0.1:12954',
    }
  }
})
