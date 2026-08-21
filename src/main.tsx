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

console.log('[RENDERER] main.tsx loaded — React mounting...');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

console.log('[RENDERER] main.tsx render() called');
