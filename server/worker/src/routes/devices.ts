// =============================================
// RosaeFinity Worker — Device Routes
// =============================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../config.js';
import { getPrisma } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import type { ApiResponse } from '../types.js';
import type { AppEnv } from '../hono-types.js';

const devices = new Hono<AppEnv>();

const registerDeviceSchema = z.object({
  deviceId: z.string().min(1),
  name: z.string().min(1).max(200),
  platform: z.string().min(1).max(100),
  appVersion: z.string().optional(),
  machineFingerprint: z.string().optional(),
});

// ── Register device ──
devices.post('/register', authenticate, async (c) => {
  const user = c.get('user');
  const body = registerDeviceSchema.parse(await c.req.json());
  const prisma = getPrisma(c.env);

  const existing = await prisma.device.findUnique({ where: { deviceId: body.deviceId } });
  if (existing) {
    await prisma.device.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date(), appVersion: body.appVersion || existing.appVersion, name: body.name },
    });
    const response: ApiResponse = { success: true, data: existing };
    return c.json(response);
  }

  const device = await prisma.device.create({
    data: { userId: user.sub, ...body },
  });

  const response: ApiResponse = { success: true, data: device };
  return c.json(response);
});

// ── List devices ──
devices.get('/', authenticate, async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);

  const deviceList = await prisma.device.findMany({
    where: { userId: user.sub },
    orderBy: { lastSeenAt: 'desc' },
  });

  const response: ApiResponse = { success: true, data: deviceList };
  return c.json(response);
});

// ── Deactivate device ──
devices.post('/deactivate', authenticate, async (c) => {
  const user = c.get('user');
  const { deviceId } = await c.req.json();
  const prisma = getPrisma(c.env);

  const device = await prisma.device.findUnique({ where: { deviceId } });
  if (!device) throw new NotFoundError('Device not found');
  if (device.userId !== user.sub) throw new BadRequestError('Not your device');

  await prisma.device.update({ where: { id: device.id }, data: { status: 'inactive' } });

  const response: ApiResponse = { success: true, data: { success: true } };
  return c.json(response);
});

// ── Rename device ──
devices.post('/rename', authenticate, async (c) => {
  const user = c.get('user');
  const { deviceId, name } = await c.req.json();
  const prisma = getPrisma(c.env);

  const device = await prisma.device.findUnique({ where: { deviceId } });
  if (!device) throw new NotFoundError('Device not found');
  if (device.userId !== user.sub) throw new BadRequestError('Not your device');

  await prisma.device.update({ where: { id: device.id }, data: { name } });

  const response: ApiResponse = { success: true, data: { success: true } };
  return c.json(response);
});

// ── Device heartbeat ──
devices.post('/heartbeat', authenticate, async (c) => {
  const { deviceId } = await c.req.json();
  const prisma = getPrisma(c.env);

  try {
    await prisma.device.update({ where: { deviceId }, data: { lastSeenAt: new Date() } });
  } catch {
    // Ignore if device not found
  }

  const response: ApiResponse = { success: true };
  return c.json(response);
});

export { devices };
