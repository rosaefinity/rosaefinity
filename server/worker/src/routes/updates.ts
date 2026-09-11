// =============================================
// RosaeFinity Worker — Update Routes
// =============================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../config.js';
import { getPrisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { ApiResponse } from '../types.js';
import type { AppEnv } from '../hono-types.js';

const updates = new Hono<AppEnv>();

const CURRENT_VERSIONS: Record<string, { version: string; releaseNotes: string; minVersion: string; isCritical: boolean }> = {
  stable: { version: '1.0.1', releaseNotes: 'Stable release with license and update system.', minVersion: '1.0.0', isCritical: false },
  beta: { version: '1.1.0-beta.1', releaseNotes: 'Beta with cloud sync foundation.', minVersion: '1.0.0', isCritical: false },
  nightly: { version: '1.1.0-nightly.42', releaseNotes: 'Nightly build with latest features.', minVersion: '0.9.0', isCritical: false },
};

const checkUpdateSchema = z.object({
  currentVersion: z.string().min(1),
  channel: z.enum(['stable', 'beta', 'nightly']).default('stable'),
  platform: z.string().optional(),
});

// ── Check for update ──
updates.post('/check', async (c) => {
  const body = checkUpdateSchema.parse(await c.req.json());
  const release = CURRENT_VERSIONS[body.channel] || CURRENT_VERSIONS.stable;
  const isUpToDate = body.currentVersion === release.version;

  const response: ApiResponse = {
    success: true,
    data: {
      available: !isUpToDate,
      currentVersion: body.currentVersion,
      latestVersion: release.version,
      channel: body.channel,
      releaseNotes: release.releaseNotes,
      minVersion: release.minVersion,
      isCritical: release.isCritical,
      downloadUrl: `https://github.com/RosaeFinity/RosaeFinity/releases/download/v${release.version}`,
    },
  };
  return c.json(response);
});

// ── Record install ──
updates.post('/install', authenticate, async (c) => {
  const body = await c.req.json();
  const prisma = getPrisma(c.env);
  const user = c.get('user');

  await prisma.updateHistory.create({
    data: {
      userId: user.sub,
      fromVersion: body.fromVersion,
      toVersion: body.toVersion,
      channel: body.channel || 'stable',
      status: 'installed',
      platform: body.platform,
    },
  });

  const response: ApiResponse = { success: true };
  return c.json(response);
});

// ── Update stats ──
updates.get('/stats', authenticate, async (c) => {
  const prisma = getPrisma(c.env);

  const total = await prisma.updateHistory.count();
  const successful = await prisma.updateHistory.count({ where: { status: 'installed' } });
  const failed = await prisma.updateHistory.count({ where: { status: 'failed' } });

  const response: ApiResponse = {
    success: true,
    data: {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(1) : '0',
    },
  };
  return c.json(response);
});

export { updates };
