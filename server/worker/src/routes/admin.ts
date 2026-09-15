// =============================================
// RosaeFinity Worker — Admin Routes
// All routes require admin authentication.
// =============================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../config.js';
import { getPrisma, createTransactionalClient } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { NotFoundError, BadRequestError, ConflictError } from '../middleware/error-handler.js';
import { generateLicenseKey } from '../utils/helpers.js';
import type { ApiResponse } from '../types.js';
import type { AppEnv } from '../hono-types.js';

const admin = new Hono<AppEnv>();

// ── All routes require admin ──
admin.use('*', authenticate, requireRole('ADMIN'));

const adminActivateSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
  durationDays: z.number().int().min(1).max(3650),
  licenseKey: z.string().optional(),
  deviceId: z.string().optional(),
  email: z.string().optional(),
});

// ── Dashboard ──
admin.get('/dashboard', async (c) => {
  const prisma = getPrisma(c.env);

  const [totalUsers, activeLicenses, totalDevices, totalSyncRecords, recentUpdates] = await Promise.all([
    prisma.user.count(),
    prisma.license.count({ where: { status: 'active' } }),
    prisma.device.count(),
    prisma.syncRecord.count(),
    prisma.updateHistory.count({ where: { installedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
  ]);

  const response: ApiResponse = {
    success: true,
    data: { totalUsers, activeLicenses, totalDevices, totalSyncRecords, recentUpdates },
  };
  return c.json(response);
});

// ── List users ──
admin.get('/users', async (c) => {
  const prisma = getPrisma(c.env);
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 20;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { licenses: { orderBy: { createdAt: 'desc' }, include: { plan: true } } },
    }),
    prisma.user.count(),
  ]);

  const response: ApiResponse = {
    success: true,
    data: users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
  return c.json(response);
});

// ── User detail ──
admin.get('/users/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const id = c.req.param('id');

  const data = await prisma.user.findUnique({
    where: { id },
    include: {
      devices: true,
      licenses: { include: { plan: true } },
      sessions: { orderBy: { lastActiveAt: 'desc' }, take: 10 },
    },
  });

  if (!data) {
    const response: ApiResponse = { success: false, error: 'User not found', code: 'NOT_FOUND' };
    return c.json(response, 404);
  }

  const now = new Date();
  const activeLicense =
    data.licenses?.find((l) =>
      (l.status === 'active' || l.status === 'grace') &&
      l.expiresAt && new Date(l.expiresAt).getTime() > now.getTime()
    ) ??
    data.licenses?.find((l) => l.status === 'active' || l.status === 'grace') ??
    data.licenses?.[0] ??
    null;

  const response: ApiResponse = {
    success: true,
    data: {
      user: {
        id: data.id,
        email: data.email,
        name: data.displayName ?? data.email?.split('@')[0] ?? 'Unknown',
        role: data.role,
        created_at: data.createdAt,
      },
      license: activeLicense
        ? {
            id: activeLicense.id,
            user_id: activeLicense.userId,
            plan: activeLicense.planId,
            status: activeLicense.status,
            expires_at: activeLicense.expiresAt,
            created_at: activeLicense.createdAt,
            updated_at: activeLicense.updatedAt,
          }
        : null,
      devices: data.devices ?? [],
      payments: [],
      activations: (data.sessions ?? []).map((s) => ({
        id: s.id,
        created_at: s.lastActiveAt ?? s.createdAt,
        action: 'session',
        performed_by: 'system',
      })),
    },
  };
  return c.json(response);
});

// ── Audit logs ──
admin.get('/audit', async (c) => {
  const prisma = getPrisma(c.env);
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 50;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.auditLog.count(),
  ]);

  const response: ApiResponse = {
    success: true,
    data: logs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
  return c.json(response);
});

// ── Health ──
admin.get('/health', async (c) => {
  const prisma = getPrisma(c.env);
  const dbOk = await prisma.$queryRawUnsafe('SELECT 1').then(() => true).catch(() => false);

  const response: ApiResponse = {
    success: true,
    data: {
      status: dbOk ? 'healthy' : 'degraded',
      database: dbOk ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    },
  };
  return c.json(response, dbOk ? 200 : 503);
});

// ── Extend license ──
admin.post('/users/:id/extend', async (c) => {
  const prisma = getPrisma(c.env);
  const id = c.req.param('id');
  const body = await c.req.json();
  const days = Number(body?.days) || 30;
  const now = new Date();

  const allProLicenses = await prisma.license.findMany({
    where: { userId: id, planId: 'pro' },
    orderBy: { createdAt: 'desc' },
  });

  if (allProLicenses.length === 0) {
    throw new NotFoundError('No Pro license found for this user. Use Activate Pro first.');
  }

  const currentActiveEntitlement = allProLicenses.find((l) =>
    (l.status === 'active' || l.status === 'grace') &&
    l.expiresAt !== null &&
    l.expiresAt.getTime() > now.getTime()
  );

  let license: typeof allProLicenses[0];
  let baseTime: Date;

  if (currentActiveEntitlement) {
    license = currentActiveEntitlement;
    baseTime = license.expiresAt!;
  } else {
    license = allProLicenses[0];
    baseTime = now;
  }

  const newExpiresAt = new Date(baseTime.getTime() + days * 24 * 60 * 60 * 1000);

  await prisma.license.update({
    where: { id: license.id },
    data: { status: 'active', expiresAt: newExpiresAt, lastValidatedAt: now },
  });

  await prisma.user.update({ where: { id }, data: { accountType: 'pro' } });

  const response: ApiResponse = {
    success: true,
    data: { success: true, status: 'active', newExpiresAt: newExpiresAt.toISOString() },
  };
  return c.json(response);
});

// ── Downgrade user ──
admin.post('/users/:id/downgrade', async (c) => {
  const prisma = getPrisma(c.env);
  const id = c.req.param('id');

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User not found');

  // Use transactional client for atomic multi-step downgrade.
  // PrismaNeonHTTP (used by getPrisma) does not support $transaction,
  // so we create a per-request transactional client with a WebSocket pool.
  const txPrisma = createTransactionalClient(c.env);
  try {
    await txPrisma.$transaction(async (tx) => {
      // Revoke all active/grace Pro licenses
      const activeLicenses = await tx.license.findMany({
        where: { userId: id, planId: 'pro', status: { in: ['active', 'grace'] } },
      });
      for (const lic of activeLicenses) {
        await tx.license.update({
          where: { id: lic.id },
          data: { status: 'revoked', expiresAt: null },
        });
      }

      // Cancel active Pro subscriptions
      const activeSubs = await tx.subscription.findMany({
        where: { userId: id, planId: 'pro', status: 'active' },
      });
      for (const sub of activeSubs) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: 'cancelled', cancelAtPeriodEnd: true },
        });
      }

      // Downgrade account type
      await tx.user.update({ where: { id }, data: { accountType: 'free' } });
    });
  } finally {
    await txPrisma.$disconnect();
  }

  const response: ApiResponse = { success: true, data: { success: true } };
  return c.json(response);
});

// ── Delete user ──
admin.delete('/users/:id', async (c) => {
  const prisma = getPrisma(c.env);
  const id = c.req.param('id');
  const currentUser = c.get('user');

  // Prevent deleting yourself
  if (currentUser.sub === id) {
    throw new BadRequestError('Cannot delete your own account');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User not found');

  // Prevent deleting other Admin accounts
  if (user.role === 'ADMIN') {
    throw new BadRequestError('Cannot delete admin accounts');
  }

  // Delete user with all cascaded relations in a transaction
  const txPrisma = createTransactionalClient(c.env);
  try {
    await txPrisma.$transaction(async (tx) => {
      // Delete related records in dependency order
      await tx.auditLog.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.apiKey.deleteMany({ where: { userId: id } });
      await tx.syncRecord.deleteMany({ where: { userId: id } });
      await tx.payment.deleteMany({ where: { userId: id } });
      await tx.subscription.deleteMany({ where: { userId: id } });
      await tx.license.deleteMany({ where: { userId: id } });
      await tx.device.deleteMany({ where: { userId: id } });
      await tx.session.deleteMany({ where: { userId: id } });
      // Finally delete the user
      await tx.user.delete({ where: { id } });
    });
  } finally {
    await txPrisma.$disconnect();
  }

  const response: ApiResponse = { success: true, data: { success: true } };
  return c.json(response);
});

// ── Activate for user ──
admin.post('/users/:id/activate', async (c) => {
  const prisma = getPrisma(c.env);
  const id = c.req.param('id');
  let body;
  try {
    body = adminActivateSchema.parse(await c.req.json());
  } catch (err: unknown) {
    const zodErr = err as { issues?: Array<{ message: string; path: (string | number)[] }> };
    const msg = zodErr.issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ') || 'Invalid request body';
    const response: ApiResponse = { success: false, error: msg, code: 'VALIDATION_ERROR' };
    return c.json(response, 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User not found');

  const existingLicense = await prisma.license.findFirst({
    where: { userId: id, status: { in: ['active', 'grace'] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
  if (existingLicense && existingLicense.planId !== 'free') {
    throw new ConflictError(`User already has an active ${existingLicense.planId} license. Deactivate it first.`);
  }

  const plan = await prisma.plan.findUnique({ where: { id: body.plan } });
  if (!plan) throw new NotFoundError(`Plan '${body.plan}' not found in database`);

  const expiresAt = new Date(Date.now() + body.durationDays * 24 * 60 * 60 * 1000);
  let licenseKey: string | null = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateLicenseKey();
    const existing = await prisma.license.findUnique({ where: { licenseKey: candidate } });
    if (!existing) { licenseKey = candidate; break; }
  }

  if (!licenseKey) throw new Error('Failed to generate a unique license key. Please try again.');

  try {
    const lic = await prisma.license.create({
      data: {
        userId: id,
        planId: body.plan,
        licenseKey,
        email: user.email ?? undefined,
        expiresAt,
      },
    });

    await prisma.user.update({ where: { id }, data: { accountType: body.plan } });

    const response: ApiResponse = {
      success: true,
      data: {
        id: lic.id,
        user_id: id,
        plan: body.plan,
        status: lic.status,
        license_key: licenseKey,
        expires_at: expiresAt.toISOString(),
      },
    };
    return c.json(response);
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') throw new ConflictError('License creation conflict. Please try again.');
    if (prismaError.code === 'P2003') throw new BadRequestError('Invalid user or plan reference.');
    throw error;
  }
});

export { admin };
