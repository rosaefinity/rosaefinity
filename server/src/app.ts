// =============================================
// RosaeFinity Server — Express Application
// Shared between Vercel (imported) and Railway/standalone (started via index.ts).
// =============================================

import express from 'express';
import { getConfig } from './config/index.js';

const DEPLOYMENT_VERSION = `v-${Date.now()}`;
const BUILD_TIME = new Date().toISOString();

/**
 * Create and configure the Express application.
 * Registers health endpoints immediately (reachable even if config fails).
 * Full middleware/routes are loaded asynchronously via setupApp().
 */
export function createApp(): express.Express {
  const app = express();

  // ── Health endpoints — registered FIRST, always reachable ──
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/deployment', (_req, res) => {
    res.json({
      version: DEPLOYMENT_VERSION,
      buildTime: BUILD_TIME,
      adminActivationRoute: true,
      schemaVersion: 'plan+durationDays',
      uptime: process.uptime(),
    });
  });

  app.get('/health/admin-routes', (_req, res) => {
    res.json({
      ok: true,
      routes: [
        'GET  /api/v1/admin/dashboard',
        'GET  /api/v1/admin/users',
        'GET  /api/v1/admin/users/:id',
        'POST /api/v1/admin/users/:id/extend',
        'POST /api/v1/admin/users/:id/downgrade',
        'POST /api/v1/admin/users/:id/activate',
        'GET  /api/v1/admin/audit',
        'GET  /api/v1/admin/health',
      ],
      version: DEPLOYMENT_VERSION,
    });
  });

  // ── Full Application Setup (async — middleware, routes, etc.) ──
  // If this fails (e.g. missing DATABASE_URL or JWT_SECRET), /health still works.
  setupApp(app).catch((err) => {
    console.error('[STARTUP] ⚠️  Full API setup failed:', err.message || err);
    console.error('[STARTUP] /health is available, but API routes are NOT loaded.');
    console.error('[STARTUP] Configure DATABASE_URL and JWT_SECRET in Railway.');
    console.error('[STARTUP] (The server stays running for health checks.)');
  });

  return app;
}

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
  // Overlay routes require persistent SSE, in-memory state, and filesystem access.
  // These are incompatible with Vercel serverless — skip on Vercel.
  const overlayRouter = process.env.VERCEL ? null : (await import('./api/modules/overlay/routes.js')).overlayRouter;
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

  // ── Overlay routes (production HTTPS browser source) ──
  // Skipped on Vercel — overlay SSE requires persistent connections and in-memory state.
  if (overlayRouter) {
    console.log('[ROUTER] Mounting overlay router at /api');
    app.use('/api', overlayRouter);
  }

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

  console.log('\n[RosaeFinity] Server v1.0.0');
  console.log(`   Environment: ${config.NODE_ENV}`);
  console.log(`   API:         /api/v1`);
  console.log(`   Health:      /health\n`);
  console.log('[STARTUP] Server ready to accept connections');
}
