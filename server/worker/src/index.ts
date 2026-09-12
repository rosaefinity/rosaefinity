// =============================================
// RosaeFinity Worker — Main Entry Point
// Cloudflare Workers + Hono
// =============================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv } from './hono-types.js';
import { requestId } from './middleware/request-id.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { errorHandler } from './middleware/error-handler.js';

// ── Route imports ──
import { health } from './routes/health.js';
import { auth } from './routes/auth.js';
import { license } from './routes/license.js';
import { devices } from './routes/devices.js';
import { sync } from './routes/sync.js';
import { updates } from './routes/updates.js';
import { analytics } from './routes/analytics.js';
import { admin } from './routes/admin.js';
import { payment } from './routes/payment.js';
import { overlay } from './routes/overlay.js';

// ── App ──
const app = new Hono<AppEnv>();

// ── Global middleware ──
app.use('*', logger());
app.use('*', requestId);

// ── CORS ──
app.use('*', async (c, next) => {
  const origins = (c.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s: string) => s.trim());

  const origin = c.req.header('Origin') || c.req.header('Referer') || '';
  const allowedOrigin = origins.find((o) => origin.startsWith(o)) || origins[0] || '*';

  c.header('Access-Control-Allow-Origin', allowedOrigin);
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-Device-Id');

  if (c.req.method === 'OPTIONS') {
    return c.newResponse(null, 204);
  }

  await next();
});

// ── Rate limiting ──
app.use('*', async (c, next) => {
  const maxRequests = parseInt(c.env.RATE_LIMIT_MAX || '100') || 100;
  const windowMs = parseInt(c.env.RATE_LIMIT_WINDOW_MS || '900000') || 900000;
  return rateLimiter(maxRequests, windowMs)(c, next);
});

// ── Security headers ──
app.use('*', async (c, next) => {
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  await next();
});

// ── Health routes (no auth) ──
app.route('/health', health);

// ── API v1 routes ──
app.route('/api/v1/auth', auth);
app.route('/api/v1/license', license);
app.route('/api/v1/devices', devices);
app.route('/api/v1/sync', sync);
app.route('/api/v1/updates', updates);
app.route('/api/v1/analytics', analytics);
app.route('/api/v1/admin', admin);
app.route('/api/v1/payment', payment);

// ── Overlay routes ──
app.route('/api/overlay', overlay);

// ── 404 handler ──
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not found',
    code: 'NOT_FOUND',
  }, 404);
});

// ── Global error handler ──
app.onError((err, c) => {
  return errorHandler(err, c);
});

export default app;
