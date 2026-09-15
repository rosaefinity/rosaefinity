// =============================================
// RosaeFinity Worker — Health Routes
// =============================================

import { Hono } from 'hono';
import type { AppEnv } from '../hono-types.js';
import { getPrisma } from '../db.js';

const health = new Hono<AppEnv>();

health.get('/', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  });
});

health.get('/deployment', (c) => {
  return c.json({
    version: 'v-workers-1.0.0',
    buildTime: new Date().toISOString(),
    adminActivationRoute: true,
    schemaVersion: 'plan+durationDays',
    runtime: 'cloudflare-workers',
  });
});

health.get('/admin-routes', (c) => {
  return c.json({
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
    version: 'v-workers-1.0.0',
  });
});

health.get('/db', async (c) => {
  try {
    const prisma = getPrisma(c.env);
    await prisma.$queryRawUnsafe('SELECT 1');
    return c.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    return c.json({
      status: 'error',
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Unknown error',
    }, 503 as any);
  }
});

health.get('/db-query', async (c) => {
  try {
    const prisma = getPrisma(c.env);
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sortOrder: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
    return c.json({
      database: 'connected',
      prisma: 'query_ok',
      model: 'Plan',
      count: plans.length,
      data: plans,
    });
  } catch (err) {
    return c.json({
      status: 'error',
      database: 'disconnected',
      prisma: 'query_failed',
      error: err instanceof Error ? err.message : 'Unknown error',
    }, 503);
  }
});

export { health };
