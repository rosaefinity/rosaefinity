// =============================================
// RosaeFinity Server — Main Entry Point
// Express application with all middleware and routes.
// =============================================

import express from 'express';
import { getHealthConfig, getConfig } from './config/index.js';

// ── Health Config (no env validation, never crashes) ──
const health = getHealthConfig();

console.log('[STARTUP] RosaeFinity server starting...');
console.log(`[STARTUP] PORT=${health.PORT}, HOST=${health.HOST}, NODE_ENV=${health.NODE_ENV}`);
console.log('[DEPLOY] Build commit: 3ce52a2 (admin-activation-route)');

// ── Create app and register /health FIRST ──
// This endpoint is reachable even if full config validation fails below.
const app = express();
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Deployment fingerprint (public, no auth) ──
app.get('/health/deployment', (_req, res) => {
  res.json({
    commit: '3ce52a2',
    adminActivationRoute: true,
    buildTimestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── Start HTTP server immediately ──
// /health is registered above, so it responds BEFORE full config validation.
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

// ── Full Application Setup ──
// If this fails (e.g. missing DATABASE_URL or JWT_SECRET), /health still works.
setupApp(app).catch((err) => {
  console.error('[STARTUP] ⚠️  Full API setup failed:', err.message || err);
  console.error('[STARTUP] /health is available, but API routes are NOT loaded.');
  console.error('[STARTUP] Configure DATABASE_URL and JWT_SECRET in Railway.');
  console.error('[STARTUP] (The server stays running for health checks.)');
});

async function setupApp(app: express.Express): Promise<void> {
  const { requestId } = await import('./api/middleware/request-id.js');
  const { rateLimiter } = await import('./api/middleware/rate-limiter.js');
  const { errorHandler } = await import('./api/middleware/error-handler.js');
  const { authRouter } = await import('./api/modules/auth/routes.js');
  const { licenseRouter } = await import('./api/modules/license/routes.js');
  const { deviceRouter } = await import('./api/modules/devices/routes.js');
  const { syncRouter } = await import('./api/modules/sync/routes.js');
  const { updateRouter } = await import('./api/modules/updates/routes.js');
  const { analyticsRouter } = await import('./api/modules/analytics/routes.js');
  const { adminRouter } = await import('./api/modules/admin/routes.js');
  const { paymentRouter } = await import('./api/modules/payment/routes.js');
  const cors = (await import('cors')).default;
  const helmet = (await import('helmet')).default;
  const compression = (await import('compression')).default;
  const morgan = (await import('morgan')).default;

  console.log('[STARTUP] Loading configuration...');
  const config = getConfig();

  // ── Startup Logging (secrets masked) ──
  console.log(`[STARTUP] Config loaded. PORT=${config.PORT}, HOST=${config.HOST}, NODE_ENV=${config.NODE_ENV}`);
  console.log(`[STARTUP] DATABASE_URL set: ${!!config.DATABASE_URL}`);
  console.log(`[STARTUP] JWT_SECRET set: ${!!config.JWT_SECRET}`);
  console.log(`[STARTUP] CORS_ORIGINS: ${config.CORS_ORIGINS}`);

  // ── Security ──
  app.use(helmet({
    contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
  }));

  // ── CORS ──
  app.use(cors({
    origin: config.CORS_ORIGINS.split(',').map(s => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Device-Id'],
  }));

  // ── Compression ──
  app.use(compression());

  // ── Body parsing ──
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Logging ──
  app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // ── Request ID ──
  app.use(requestId);

  // ── Rate Limiting ──
  app.use(rateLimiter);

  // ── API Routes (v1) ──
  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/license', licenseRouter);
  apiV1.use('/devices', deviceRouter);
  apiV1.use('/sync', syncRouter);
  apiV1.use('/updates', updateRouter);
  apiV1.use('/analytics', analyticsRouter);
  apiV1.use('/admin', adminRouter);
  apiV1.use('/payment', paymentRouter);

  // ── Mount API router ──
  console.log('[ROUTER] Mounting API router at /api/v1');
  app.use('/api/v1', apiV1);
  console.log('[ROUTER] API router mounted at /api/v1');
  console.log('[ROUTER] Admin routes: /dashboard, /users, /users/:id, /users/:id/extend, /users/:id/downgrade, /users/:id/activate, /audit, /health');

  // ── 404 Handler ──
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      code: 'NOT_FOUND',
    });
  });

  // ── Error Handler ──
  app.use(errorHandler);

  // ── Server already listening — log readiness ──
  console.log('\n[RosaeFinity] Server v1.0.0');
  console.log(`   Environment: ${config.NODE_ENV}`);
  console.log(`   Listening:   http://${config.HOST}:${config.PORT}`);
  console.log(`   API:         http://${config.HOST}:${config.PORT}/api/v1`);
  console.log(`   Health:      http://${config.HOST}:${config.PORT}/health\n`);
  console.log('[STARTUP] Server ready to accept connections');
}
