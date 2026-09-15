import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ── Global error handlers (capture FIRST crash) ──
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[RENDERER-FATAL] window.onerror:', { message, source, lineno, colno, error });
  console.error('[RENDERER-FATAL] stack:', error?.stack);
  return false; // Allow default handler
};

window.onunhandledrejection = (event) => {
  console.error('[RENDERER-FATAL] unhandledrejection:', event.reason);
  console.error('[RENDERER-FATAL] stack:', event.reason?.stack);
};

console.log('[RENDERER-BOOT] pid=' + (window.process?.pid || 'unknown') + ' renderer_id=' + (window.__RENDERER_ID || Math.random().toString(36).slice(2)));
window.__RENDERER_ID = window.__RENDERER_ID || Math.random().toString(36).slice(2);
console.log('[RENDERER] main.tsx loaded — React mounting...');

// Disable StrictMode in Electron to prevent double-render crashes
const useStrictMode = !window.electronAPI;

createRoot(document.getElementById('root')!).render(
  useStrictMode ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  ),
)

console.log('[RENDERER] main.tsx render() called');
