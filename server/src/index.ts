// =============================================
// RosaeFinity Server — Standalone Entry Point
// For Railway / local development / direct node execution.
// On Vercel, api/index.ts is used instead — this file is NOT executed.
// =============================================

import { createApp } from './app.js';
import { getHealthConfig } from './config/index.js';

const health = getHealthConfig();

console.log('[STARTUP] RosaeFinity server starting...');
console.log(`[STARTUP] PORT=${health.PORT}, HOST=${health.HOST}, NODE_ENV=${health.NODE_ENV}`);
console.log('[DEPLOY] Build timestamp:', new Date().toISOString());

const app = createApp();

// ── Start HTTP server (Railway / local only) ──
// On Vercel, app.listen() is skipped — Vercel manages the server lifecycle.
if (!process.env.VERCEL) {
  const server = app.listen(health.PORT, health.HOST, () => {
    console.log(`[STARTUP] Server listening on ${health.HOST}:${health.PORT}`);
    console.log(`[STARTUP] /health is available at http://${health.HOST}:${health.PORT}/health`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[STARTUP] ❌ Port ${health.PORT} is already in use. Another process is using it.`);
      console.error('[STARTUP] Kill the other process or set a different PORT.');
      process.exit(1);
    }
    console.error('[STARTUP] ❌ Server error:', err);
    process.exit(1);
  });
}
