// =============================================
// RosaeFinity Worker — Sync Routes
// =============================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../config.js';
import { getPrisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { syncRateLimiter } from '../middleware/rate-limiter.js';
import { computeChecksum } from '../utils/helpers.js';
import type { ApiResponse, JwtPayload, SyncPayload, SyncResult } from '../types.js';
import type { AppEnv } from '../hono-types.js';
import type { Prisma } from '@prisma/client';

const sync = new Hono<AppEnv>();

const syncPushSchema = z.object({
  entityType: z.enum(['action', 'sound', 'overlay', 'settings', 'alert', 'goal', 'preference']),
  entityId: z.string().min(1),
  data: z.record(z.unknown()),
  version: z.number().int().positive(),
  checksum: z.string().min(1),
  updatedAt: z.number().int().positive(),
});

const syncBatchSchema = z.object({
  records: z.array(syncPushSchema).max(100),
  clientVersion: z.number().int().default(0),
});

const syncPullSchema = z.object({
  entityType: z.enum(['action', 'sound', 'overlay', 'settings', 'alert', 'goal', 'preference']).optional(),
  sinceVersion: z.coerce.number().int().default(0),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// ── Push sync records ──
sync.post('/push', authenticate, syncRateLimiter(), async (c) => {
  const user = c.get('user');
  const body = syncBatchSchema.parse(await c.req.json());
  const prisma = getPrisma(c.env);

  const accepted: SyncPayload[] = [];
  const rejected: { entity: SyncPayload; reason: string }[] = [];

  for (const record of body.records) {
    const expectedChecksum = await computeChecksum(record.data);
    if (expectedChecksum !== record.checksum) {
      rejected.push({ entity: record, reason: 'Checksum mismatch — data may be corrupted' });
      continue;
    }

    try {
      const saved = await prisma.syncRecord.upsert({
        where: { userId_entityType_entityId: { userId: user.sub, entityType: record.entityType, entityId: record.entityId } },
        update: { data: record.data as unknown as Prisma.InputJsonValue, version: record.version, checksum: record.checksum, serverVersion: { increment: 1 } },
        create: { userId: user.sub, entityType: record.entityType, entityId: record.entityId, data: record.data as unknown as Prisma.InputJsonValue, version: record.version, checksum: record.checksum, serverVersion: 1 },
      });
      accepted.push({ ...record, version: saved.version });
    } catch (err: unknown) {
      rejected.push({ entity: record, reason: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  const result = await prisma.syncRecord.aggregate({ where: { userId: user.sub }, _max: { serverVersion: true } });
  const serverVersion = result._max.serverVersion || 0;

  const response: ApiResponse = { success: true, data: { accepted, rejected, serverVersion } satisfies SyncResult };
  return c.json(response);
});

// ── Pull sync records ──
sync.get('/pull', authenticate, async (c) => {
  const user = c.get('user');
  const query = syncPullSchema.parse(c.req.query());
  const prisma = getPrisma(c.env);

  const where: Record<string, unknown> = { userId: user.sub, serverVersion: { gt: query.sinceVersion } };
  if (query.entityType) where.entityType = query.entityType;

  const records = await prisma.syncRecord.findMany({
    where: where as any,
    orderBy: { serverVersion: 'asc' },
    take: 500,
  });

  const result = await prisma.syncRecord.aggregate({ where: { userId: user.sub }, _max: { serverVersion: true } });
  const serverVersion = result._max.serverVersion || 0;

  const response: ApiResponse = {
    success: true,
    data: { records: records.slice(0, query.limit), serverVersion },
  };
  return c.json(response);
});

// ── Delete sync record ──
sync.post('/delete', authenticate, async (c) => {
  const user = c.get('user');
  const { entityType, entityId } = await c.req.json();
  const prisma = getPrisma(c.env);

  await prisma.syncRecord.deleteMany({ where: { userId: user.sub, entityType, entityId } });

  const response: ApiResponse = { success: true, data: { success: true } };
  return c.json(response);
});

// ── Get server version ──
sync.get('/version', authenticate, async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);

  const result = await prisma.syncRecord.aggregate({ where: { userId: user.sub }, _max: { serverVersion: true } });
  const version = result._max.serverVersion || 0;

  const response: ApiResponse = { success: true, data: { serverVersion: version } };
  return c.json(response);
});

export { sync };
