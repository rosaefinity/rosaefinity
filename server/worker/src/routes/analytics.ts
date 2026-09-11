// =============================================
// RosaeFinity Worker — Analytics Routes
// =============================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../config.js';
import { getPrisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { ApiResponse } from '../types.js';
import type { AppEnv } from '../hono-types.js';
import type { Prisma } from '@prisma/client';

const analytics = new Hono<AppEnv>();

const analyticsEventSchema = z.object({
  eventType: z.enum(['app_start', 'feature_usage', 'crash_report', 'performance_metric', 'update_installed', 'license_activated', 'session_duration']),
  eventData: z.record(z.unknown()),
  appVersion: z.string().optional(),
  platform: z.string().optional(),
  sessionId: z.string().optional(),
});

// ── Track event ──
analytics.post('/track', async (c) => {
  const body = analyticsEventSchema.parse(await c.req.json());
  const prisma = getPrisma(c.env);

  let userId: string | undefined;
  try {
    const user = c.get('user');
    userId = user?.sub;
  } catch {
    // Optional auth — track event even without user
  }

  await prisma.analyticsEvent.create({
    data: {
      userId,
      eventType: body.eventType,
      eventData: body.eventData as unknown as Prisma.InputJsonValue,
      appVersion: body.appVersion,
      platform: body.platform,
      sessionId: body.sessionId,
    },
  });

  const response: ApiResponse = { success: true };
  return c.json(response);
});

// ── Dashboard ──
analytics.get('/dashboard', authenticate, async (c) => {
  const prisma = getPrisma(c.env);

  const [eventCounts, versionDistribution, platformDistribution] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      _count: true,
    }).then((results) => results.map((r) => ({ eventType: r.eventType, count: r._count }))),
    prisma.analyticsEvent.groupBy({
      by: ['appVersion'],
      _count: true,
      where: { appVersion: { not: null } },
    }).then((results) => results.map((r) => ({ version: r.appVersion, count: r._count }))),
    prisma.analyticsEvent.groupBy({
      by: ['platform'],
      _count: true,
      where: { platform: { not: null } },
    }).then((results) => results.map((r) => ({ platform: r.platform, count: r._count }))),
  ]);

  const response: ApiResponse = {
    success: true,
    data: { eventCounts, versionDistribution, platformDistribution },
  };
  return c.json(response);
});

// ── Events ──
analytics.get('/events', authenticate, async (c) => {
  const prisma = getPrisma(c.env);
  const eventType = c.req.query('eventType');
  const limit = Number(c.req.query('limit')) || 100;

  const events = await prisma.analyticsEvent.findMany({
    where: eventType ? { eventType } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const response: ApiResponse = { success: true, data: events };
  return c.json(response);
});

export { analytics };
