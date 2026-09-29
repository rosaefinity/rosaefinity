// =============================================
// RosaeFinity Worker — License Routes
// =============================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../config.js';
import { getPrisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/error-handler.js';
import { maskLicenseKey } from '../utils/helpers.js';
import type { ApiResponse } from '../types.js';
import type { AppEnv } from '../hono-types.js';

const license = new Hono<AppEnv>();

const activateLicenseSchema = z.object({
  licenseKey: z.string().regex(/^ROSAE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Invalid license key format'),
  email: z.string().email().optional(),
  deviceId: z.string().min(1),
  userId: z.string().optional(),
});

// ── Activate license ──
license.post('/activate', authenticate, async (c) => {
  const user = c.get('user');
  const body = activateLicenseSchema.parse(await c.req.json());
  const prisma = getPrisma(c.env);

  const existing = await prisma.license.findFirst({
    where: { userId: user.sub, status: { in: ['active', 'grace'] } },
  });
  if (existing && existing.planId !== 'free') {
    throw new BadRequestError('User already has an active license');
  }

  if (!/^ROSAE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(body.licenseKey)) {
    throw new BadRequestError('Invalid license key format');
  }

  const existingKey = await prisma.license.findUnique({
    where: { licenseKey: body.licenseKey },
    include: { plan: true, user: true },
  });
  if (existingKey && existingKey.status === 'revoked') {
    throw new ForbiddenError('This license key has been revoked');
  }

  const planId = body.licenseKey.startsWith('ROSAE-ENT') ? 'enterprise' : 'pro';
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) throw new NotFoundError('Plan not found');

  const deviceCount = await prisma.device.count({
    where: { userId: user.sub, status: 'active' },
  });
  if (deviceCount >= plan.maxDevices) {
    throw new BadRequestError(`Device limit reached (${plan.maxDevices}). Deactivate a device first.`);
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  let result;
  if (existingKey) {
    result = await prisma.license.update({
      where: { id: existingKey.id },
      data: {
        status: 'active',
        userId: user.sub,
        expiresAt,
        email: body.email || existingKey.email,
        lastValidatedAt: new Date(),
      },
      include: { plan: true },
    });
  } else {
    result = await prisma.license.create({
      data: {
        userId: user.sub,
        planId,
        licenseKey: body.licenseKey,
        email: body.email,
        expiresAt,
      },
    });
  }

  await prisma.user.update({ where: { id: user.sub }, data: { accountType: planId } });

  const response: ApiResponse = { success: true, data: result };
  return c.json(response);
});

// ── Deactivate license ──
license.post('/deactivate', authenticate, async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);

  const existing = await prisma.license.findFirst({
    where: { userId: user.sub, status: { in: ['active', 'grace'] } },
  });
  if (!existing) throw new NotFoundError('No active license');

  await prisma.license.update({
    where: { id: existing.id },
    data: { status: 'expired' },
  });
  await prisma.user.update({ where: { id: user.sub }, data: { accountType: 'free' } });

  const response: ApiResponse = { success: true, data: { success: true, planTier: 'free' } };
  return c.json(response);
});

// ── License status ──
license.get('/status', authenticate, async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);

  const existing = await prisma.license.findFirst({
    where: { userId: user.sub, status: { in: ['active', 'grace'] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!existing) {
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'none',
        planTier: 'free',
        features: [],
        limits: { maxActions: 5, maxSounds: 3, maxOverlays: 2, maxProfiles: 1, maxScreens: 1, maxPointsUsers: 0, maxDevices: 1 },
        expiresAt: null,
      },
    };
    return c.json(response);
  }

  const now = Date.now();
  let status = existing.status;
  if (existing.expiresAt && now > existing.expiresAt.getTime()) {
    const graceEnd = existing.expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000;
    status = now <= graceEnd ? 'grace' : 'expired';
  }

  const response: ApiResponse = {
    success: true,
    data: {
      status,
      planTier: existing.planId,
      features: existing.plan.features,
      limits: {
        maxActions: existing.plan.maxActions,
        maxSounds: existing.plan.maxSounds,
        maxOverlays: existing.plan.maxOverlays,
        maxProfiles: existing.plan.maxProfiles,
        maxScreens: existing.plan.maxScreens,
        maxPointsUsers: existing.plan.maxPointsUsers,
        maxDevices: existing.plan.maxDevices,
      },
      expiresAt: existing.expiresAt,
      licenseKey: existing.licenseKey ? maskLicenseKey(existing.licenseKey) : null,
    },
  };
  return c.json(response);
});

// ── List plans ──
license.get('/plans', async (c) => {
  const prisma = getPrisma(c.env);
  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  const response: ApiResponse = { success: true, data: plans };
  return c.json(response);
});

export { license };
