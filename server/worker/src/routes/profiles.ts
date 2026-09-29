// =============================================
// RosaeFinity Worker — Stream Profile Routes
// Account-scoped CRUD with entitlement enforcement.
// =============================================

import { Hono } from 'hono';
import { z } from 'zod';
import { getPrisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import type { ApiResponse } from '../types.js';
import type { AppEnv } from '../hono-types.js';

const profiles = new Hono<AppEnv>();

// ── Schemas ──
const createProfileSchema = z.object({
  name: z.string().min(1).max(30),
  icon: z.string().optional(),
  tiktokUsername: z.string().optional().default(''),
  overlaySettings: z.record(z.unknown()).optional().default({}),
  alertsSettings: z.record(z.unknown()).optional().default({}),
  actions: z.array(z.record(z.unknown())).optional().default([]),
  events: z.array(z.record(z.unknown())).optional().default([]),
  ttsSettings: z.record(z.unknown()).optional().default({}),
  sortOrder: z.number().int().optional().default(0),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  icon: z.string().optional(),
  tiktokUsername: z.string().optional(),
  overlaySettings: z.record(z.unknown()).optional(),
  alertsSettings: z.record(z.unknown()).optional(),
  actions: z.array(z.record(z.unknown())).optional(),
  events: z.array(z.record(z.unknown())).optional(),
  ttsSettings: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
});

// ── Helper: get effective max profiles from subscription ──
async function getMaxProfiles(prisma: any, userId: string): Promise<number> {
  // Find the user's active license
  const license = await prisma.license.findFirst({
    where: {
      userId,
      status: { in: ['active', 'grace'] },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  if (license?.plan?.maxProfiles && license.plan.maxProfiles > 0) {
    return license.plan.maxProfiles;
  }

  // Fallback: check user's accountType
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.accountType === 'pro' || user?.accountType === 'enterprise') {
    return 10;
  }

  return 1; // Free default
}

// ── List profiles ──
profiles.get('/', authenticate, async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);

  const rows = await prisma.streamProfile.findMany({
    where: { userId: user.sub },
    orderBy: { sortOrder: 'asc' },
  });

  const maxProfiles = await getMaxProfiles(prisma, user.sub);

  const data = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    tiktokUsername: r.tiktokUsername,
    overlaySettings: r.overlaySettings,
    alertsSettings: r.alertsSettings,
    actions: r.actions,
    events: r.events,
    ttsSettings: r.ttsSettings,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
    updatedAt: r.updatedAt?.toISOString?.() ?? r.updatedAt,
  }));

  const response: ApiResponse = {
    success: true,
    data: { profiles: data, maxProfiles },
  };
  return c.json(response);
});

// ── Create profile ──
profiles.post('/', authenticate, async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);
  const body = createProfileSchema.parse(await c.req.json());

  // Enforce profile limit
  const maxProfiles = await getMaxProfiles(prisma, user.sub);
  const currentCount = await prisma.streamProfile.count({ where: { userId: user.sub } });

  if (currentCount >= maxProfiles) {
    const response: ApiResponse = {
      success: false,
      error: `Profile limit reached (${maxProfiles}). Upgrade to Pro for more profiles.`,
      code: 'PROFILE_LIMIT_REACHED',
    };
    return c.json(response, 403);
  }

  // Ensure unique name per user
  const existing = await prisma.streamProfile.findFirst({
    where: { userId: user.sub, name: body.name },
  });
  if (existing) {
    const response: ApiResponse = {
      success: false,
      error: 'A profile with this name already exists.',
      code: 'PROFILE_NAME_CONFLICT',
    };
    return c.json(response, 409);
  }

  const profile = await prisma.streamProfile.create({
    data: {
      userId: user.sub,
      name: body.name,
      icon: body.icon,
      tiktokUsername: body.tiktokUsername,
      overlaySettings: body.overlaySettings as any,
      alertsSettings: body.alertsSettings as any,
      actions: body.actions as any,
      events: body.events as any,
      ttsSettings: body.ttsSettings as any,
      sortOrder: body.sortOrder ?? currentCount,
    },
  });

  const response: ApiResponse = {
    success: true,
    data: {
      id: profile.id,
      name: profile.name,
      icon: profile.icon,
      tiktokUsername: profile.tiktokUsername,
      overlaySettings: profile.overlaySettings,
      alertsSettings: profile.alertsSettings,
      actions: profile.actions,
      events: profile.events,
      ttsSettings: profile.ttsSettings,
      sortOrder: profile.sortOrder,
      createdAt: profile.createdAt?.toISOString?.() ?? profile.createdAt,
      updatedAt: profile.updatedAt?.toISOString?.() ?? profile.updatedAt,
    },
  };
  return c.json(response, 201);
});

// ── Update profile ──
profiles.put('/:id', authenticate, async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);
  const profileId = c.req.param('id');
  const body = updateProfileSchema.parse(await c.req.json());

  // Verify ownership
  const existing = await prisma.streamProfile.findFirst({
    where: { id: profileId, userId: user.sub },
  });
  if (!existing) {
    const response: ApiResponse = {
      success: false,
      error: 'Profile not found.',
      code: 'PROFILE_NOT_FOUND',
    };
    return c.json(response, 404);
  }

  // If renaming, check uniqueness
  if (body.name && body.name !== existing.name) {
    const nameConflict = await prisma.streamProfile.findFirst({
      where: { userId: user.sub, name: body.name, id: { not: profileId } },
    });
    if (nameConflict) {
      const response: ApiResponse = {
        success: false,
        error: 'A profile with this name already exists.',
        code: 'PROFILE_NAME_CONFLICT',
      };
      return c.json(response, 409);
    }
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.icon !== undefined) updateData.icon = body.icon;
  if (body.tiktokUsername !== undefined) updateData.tiktokUsername = body.tiktokUsername;
  if (body.overlaySettings !== undefined) updateData.overlaySettings = body.overlaySettings;
  if (body.alertsSettings !== undefined) updateData.alertsSettings = body.alertsSettings;
  if (body.actions !== undefined) updateData.actions = body.actions;
  if (body.events !== undefined) updateData.events = body.events;
  if (body.ttsSettings !== undefined) updateData.ttsSettings = body.ttsSettings;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

  const profile = await prisma.streamProfile.update({
    where: { id: profileId },
    data: updateData,
  });

  const response: ApiResponse = {
    success: true,
    data: {
      id: profile.id,
      name: profile.name,
      icon: profile.icon,
      tiktokUsername: profile.tiktokUsername,
      overlaySettings: profile.overlaySettings,
      alertsSettings: profile.alertsSettings,
      actions: profile.actions,
      events: profile.events,
      ttsSettings: profile.ttsSettings,
      sortOrder: profile.sortOrder,
      createdAt: profile.createdAt?.toISOString?.() ?? profile.createdAt,
      updatedAt: profile.updatedAt?.toISOString?.() ?? profile.updatedAt,
    },
  };
  return c.json(response);
});

// ── Delete profile ──
profiles.delete('/:id', authenticate, async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);
  const profileId = c.req.param('id');

  // Verify ownership
  const existing = await prisma.streamProfile.findFirst({
    where: { id: profileId, userId: user.sub },
  });
  if (!existing) {
    const response: ApiResponse = {
      success: false,
      error: 'Profile not found.',
      code: 'PROFILE_NOT_FOUND',
    };
    return c.json(response, 404);
  }

  await prisma.streamProfile.delete({ where: { id: profileId } });

  const response: ApiResponse = { success: true, data: { success: true } };
  return c.json(response);
});

// ── Bulk upsert (for migration/sync) ──
profiles.post('/bulk', authenticate, async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);
  const body = z.object({
    profiles: z.array(z.object({
      serverId: z.string().optional(),
      name: z.string().min(1).max(30),
      icon: z.string().optional(),
      tiktokUsername: z.string().optional().default(''),
      overlaySettings: z.record(z.unknown()).optional().default({}),
      alertsSettings: z.record(z.unknown()).optional().default({}),
      actions: z.array(z.record(z.unknown())).optional().default([]),
      events: z.array(z.record(z.unknown())).optional().default([]),
      ttsSettings: z.record(z.unknown()).optional().default({}),
      sortOrder: z.number().int().optional().default(0),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
    })).max(10),
  }).parse(await c.req.json());

  const results: Array<{ localIndex: number; serverId: string; name: string }> = [];

  for (let i = 0; i < body.profiles.length; i++) {
    const p = body.profiles[i];

    if (p.serverId) {
      // Update existing
      const existing = await prisma.streamProfile.findFirst({
        where: { id: p.serverId, userId: user.sub },
      });
      if (existing) {
        await prisma.streamProfile.update({
          where: { id: p.serverId },
          data: {
            name: p.name,
            icon: p.icon,
            tiktokUsername: p.tiktokUsername,
            overlaySettings: p.overlaySettings as any,
            alertsSettings: p.alertsSettings as any,
            actions: p.actions as any,
            events: p.events as any,
            ttsSettings: p.ttsSettings as any,
            sortOrder: p.sortOrder,
          },
        });
        results.push({ localIndex: i, serverId: p.serverId, name: p.name });
      }
    } else {
      // Create new — skip if name conflict
      const conflict = await prisma.streamProfile.findFirst({
        where: { userId: user.sub, name: p.name },
      });
      if (conflict) {
        results.push({ localIndex: i, serverId: conflict.id, name: p.name });
        continue;
      }

      const maxProfiles = await getMaxProfiles(prisma, user.sub);
      const count = await prisma.streamProfile.count({ where: { userId: user.sub } });
      if (count >= maxProfiles) break;

      const created = await prisma.streamProfile.create({
        data: {
          userId: user.sub,
          name: p.name,
          icon: p.icon,
          tiktokUsername: p.tiktokUsername,
          overlaySettings: p.overlaySettings as any,
          alertsSettings: p.alertsSettings as any,
          actions: p.actions as any,
          events: p.events as any,
          ttsSettings: p.ttsSettings as any,
          sortOrder: p.sortOrder ?? count,
        },
      });
      results.push({ localIndex: i, serverId: created.id, name: p.name });
    }
  }

  const response: ApiResponse = { success: true, data: { results } };
  return c.json(response);
});

export { profiles };
