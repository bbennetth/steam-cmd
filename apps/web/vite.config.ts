import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev: Vite serves the SPA on 5173 and proxies /api (incl. SSE) to the
// Hono panel on 8080. Prod: `vite build` emits dist/, which the Hono
// server serves directly (single origin).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', sourcemap: 'hidden' },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.PANEL_API_URL ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
