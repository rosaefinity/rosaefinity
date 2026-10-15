import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    // Disable HMR in Electron to prevent full page reloads when Vite's
    // WebSocket reconnects after a navigation. In Electron, HMR triggers
    // did-start-loading → did-navigate → renderer remount cycles.
    hmr: false,
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'coin-jar': resolve(__dirname, 'coin-jar.html'),
        'goals-widget': resolve(__dirname, 'goals-widget.html'),
        'browser-source': resolve(__dirname, 'overlay-entry.html'),
      },
    },
  },
})
