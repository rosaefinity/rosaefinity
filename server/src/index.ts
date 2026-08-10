// =============================================
// RosaeFinity Server — Main Entry Point
// Express application with all middleware and routes.
// =============================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { getConfig } from './config/index.js';
import { requestId } from './api/middleware/request-id.js';
import { rateLimiter } from './api/middleware/rate-limiter.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { authRouter } from './api/modules/auth/routes.js';
import { licenseRouter } from './api/modules/license/routes.js';
import { deviceRouter } from './api/modules/devices/routes.js';
import { syncRouter } from './api/modules/sync/routes.js';
import { updateRouter } from './api/modules/updates/routes.js';
import { analyticsRouter } from './api/modules/analytics/routes.js';
import { adminRouter } from './api/modules/admin/routes.js';

async function main(): Promise<void> {
  const config = getConfig();
  const app = express();

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

  // ── Health Check ──
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // ── API Routes (v1) ──
  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/license', licenseRouter);
  apiV1.use('/devices', deviceRouter);
  apiV1.use('/sync', syncRouter);
  apiV1.use('/updates', updateRouter);
  apiV1.use('/analytics', analyticsRouter);
  apiV1.use('/admin', adminRouter);
  app.use('/api/v1', apiV1);

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

  // ── Start Server ──
  app.listen(config.PORT, config.HOST, () => {
    console.log(`\n🌹 RosaeFinity Server v1.0.0`);
    console.log(`   Environment: ${config.NODE_ENV}`);
    console.log(`   Listening:   http://${config.HOST}:${config.PORT}`);
    console.log(`   API:         http://${config.HOST}:${config.PORT}/api/v1`);
    console.log(`   Health:      http://${config.HOST}:${config.PORT}/health\n`);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
