import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Fail the production build when the renderer API URL is missing or malformed.
// v1.0.4 shipped with an empty VITE_API_URL, producing relative /v1/auth/* URLs
// and a generic login error. This guard makes that impossible to release again.
function assertProductionApiUrl(mode: string, rawValue: string | undefined): void {
  if (mode !== 'production') return;
  const raw = (rawValue ?? '').trim();
  if (!raw) throw new Error('VITE_API_URL is required for production builds.');
  if (raw === 'YOUR_BACKEND_API_URL' || !/^https?:\/\//i.test(raw)) {
    throw new Error('VITE_API_URL must be an absolute HTTP(S) URL.');
  }
  if (/\/api\/api$/i.test(raw.replace(/\/+$/, ''))) {
    throw new Error('VITE_API_URL must contain the /api prefix only once.');
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  assertProductionApiUrl(mode, process.env.VITE_API_URL ?? env.VITE_API_URL);
  return {
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
  }
})
