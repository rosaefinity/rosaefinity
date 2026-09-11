// =============================================
// RosaeFinity Worker — Auth Routes
// POST /api/v1/auth/*
// =============================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../config.js';
import { getConfig } from '../config.js';
import { getPrisma } from '../db.js';
import { generateTokens, verifyRefreshToken } from '../jwt.js';
import { hashPassword, verifyPassword, rehashPassword } from '../password.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rate-limiter.js';
import { generateId } from '../crypto.js';
import { BadRequestError, UnauthorizedError, NotFoundError, ConflictError } from '../middleware/error-handler.js';
import type { ApiResponse, JwtPayload } from '../types.js';
import type { AppEnv } from '../hono-types.js';
import type { Prisma } from '@prisma/client';

const auth = new Hono<AppEnv>();

// ── Schemas ──
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── Helper: resolve entitlements ──
async function getSubscription(env: Env, userId: string) {
  const prisma = getPrisma(env);
  const license = await prisma.license.findFirst({
    where: { userId, planId: 'pro', status: { in: ['active', 'grace'] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  const now = Date.now();
  const isPro = license != null && (!license.expiresAt || license.expiresAt.getTime() > now);

  const plan = isPro ? 'pro' : 'free';
  const status = isPro ? 'active' : 'free';
  const features = isPro && license?.plan
    ? {
        maxActions: null as number | null,
        maxScenes: license.plan.maxScreens || 10,
        maxOverlayPresets: license.plan.maxOverlays || 50,
        maxDevices: license.plan.maxDevices || 5,
        actionsUnlimited: true,
        multiScreen: true,
        premiumOverlay: true,
        cloudBackup: true,
      }
    : {
        maxActions: 5,
        maxScenes: 1,
        maxOverlayPresets: 10,
        maxDevices: 1,
        actionsUnlimited: false,
        multiScreen: false,
        premiumOverlay: false,
        cloudBackup: false,
      };

  return {
    plan,
    status,
    features,
    expiresAt: license?.expiresAt?.getTime() ?? null,
    isExpired: isPro ? false : !!(license?.expiresAt && license.expiresAt.getTime() < now),
  };
}

// ── Public routes ──
auth.post('/register', authRateLimiter(), async (c) => {
  const body = registerSchema.parse(await c.req.json());
  const prisma = getPrisma(c.env);
  const config = getConfig(c.env);

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new ConflictError('Email already registered');

  const passwordHash = await hashPassword(body.password);

  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash,
      displayName: body.displayName || body.email.split('@')[0],
      authProvider: 'email',
    },
  });

  const tokens = await generateTokens(
    { sub: user.id, email: user.email || '', planTier: user.accountType, role: user.role || 'USER' },
    config.JWT_SECRET, config.JWT_EXPIRES_IN, config.JWT_REFRESH_EXPIRES_IN,
  );

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
    },
  });

  const { passwordHash: _, ...safeUser } = user;
  const response: ApiResponse = { success: true, data: { user: safeUser, ...tokens } };
  return c.json(response, 201);
});

auth.post('/login', authRateLimiter(), async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const prisma = getPrisma(c.env);
  const config = getConfig(c.env);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.passwordHash) throw new UnauthorizedError('Invalid credentials');

  const { verified, needsMigration } = await verifyPassword(body.password, user.passwordHash);
  if (!verified) throw new UnauthorizedError('Invalid credentials');

  // Migrate bcrypt hash to scrypt if needed
  if (needsMigration) {
    const newHash = await rehashPassword(body.password);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });
  }

  const tokens = await generateTokens(
    { sub: user.id, email: user.email || '', planTier: user.accountType, role: user.role || 'USER' },
    config.JWT_SECRET, config.JWT_EXPIRES_IN, config.JWT_REFRESH_EXPIRES_IN,
  );

  const expiresAt = new Date(Date.now() + (body.rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
    },
  });

  const { passwordHash: _ph, ...safeUser } = user;
  const response: ApiResponse = { success: true, data: { user: safeUser, ...tokens } };
  return c.json(response);
});

auth.post('/login/google', authRateLimiter(), async (c) => {
  const body = await c.req.json();
  const prisma = getPrisma(c.env);
  const config = getConfig(c.env);

  const accessToken = body.accessToken as string;
  let user = await prisma.user.findFirst({
    where: { authProvider: 'google', providerId: accessToken },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { authProvider: 'google', providerId: accessToken },
    });
  }

  const tokens = await generateTokens(
    { sub: user.id, email: user.email || '', planTier: user.accountType, role: user.role || 'USER' },
    config.JWT_SECRET, config.JWT_EXPIRES_IN, config.JWT_REFRESH_EXPIRES_IN,
  );

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId: user.id, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt },
  });

  const response: ApiResponse = { success: true, data: { user, ...tokens } };
  return c.json(response);
});

auth.post('/login/guest', authRateLimiter(), async (c) => {
  const prisma = getPrisma(c.env);
  const config = getConfig(c.env);

  const user = await prisma.user.create({
    data: {
      authProvider: 'anonymous',
      isAnonymous: true,
      displayName: `Guest-${generateId().substring(0, 6)}`,
    },
  });

  const tokens = await generateTokens(
    { sub: user.id, email: '', planTier: 'guest', role: 'USER' },
    config.JWT_SECRET, config.JWT_EXPIRES_IN, config.JWT_REFRESH_EXPIRES_IN,
  );

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId: user.id, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt },
  });

  const response: ApiResponse = { success: true, data: { user, ...tokens } };
  return c.json(response);
});

auth.post('/refresh', async (c) => {
  const body = refreshSchema.parse(await c.req.json());
  const prisma = getPrisma(c.env);
  const config = getConfig(c.env);

  let payload: JwtPayload;
  try {
    payload = await verifyRefreshToken(body.refreshToken, config.JWT_SECRET);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const session = await prisma.session.findUnique({
    where: { refreshToken: body.refreshToken },
  });
  if (!session) throw new UnauthorizedError('Invalid refresh token');

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new UnauthorizedError('User not found');

  const tokens = await generateTokens(
    { sub: user.id, email: user.email || '', planTier: user.accountType, role: user.role || 'USER' },
    config.JWT_SECRET, config.JWT_EXPIRES_IN, config.JWT_REFRESH_EXPIRES_IN,
  );

  await prisma.session.delete({ where: { id: session.id } });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId: user.id, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt },
  });

  const response: ApiResponse = { success: true, data: { user, ...tokens } };
  return c.json(response);
});

// ── Protected routes ──
auth.post('/logout', authenticate, async (c) => {
  const prisma = getPrisma(c.env);
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.split(' ')[1] || '';

  const session = await prisma.session.findUnique({ where: { accessToken: token } });
  if (session) {
    await prisma.session.delete({ where: { id: session.id } });
  }

  const response: ApiResponse = { success: true, data: { success: true } };
  return c.json(response);
});

auth.post('/logout-all', authenticate, async (c) => {
  const prisma = getPrisma(c.env);
  const user = c.get('user');

  await prisma.session.deleteMany({ where: { userId: user.sub } });

  const response: ApiResponse = { success: true, data: { success: true } };
  return c.json(response);
});

auth.get('/me', authenticate, async (c) => {
  const prisma = getPrisma(c.env);
  const user = c.get('user');

  const dbUser = await prisma.user.findUnique({ where: { id: user.sub } });
  if (!dbUser) throw new NotFoundError('User not found');

  const { passwordHash: _ph, ...safeUser } = dbUser;
  const response: ApiResponse = { success: true, data: safeUser };
  return c.json(response);
});

auth.get('/subscription', authenticate, async (c) => {
  const user = c.get('user');
  const sub = await getSubscription(c.env as Env, user.sub);
  const response: ApiResponse = { success: true, data: sub };
  return c.json(response);
});

auth.get('/sessions', authenticate, async (c) => {
  const prisma = getPrisma(c.env);
  const user = c.get('user');

  const sessions = await prisma.session.findMany({
    where: { userId: user.sub },
    orderBy: { lastActiveAt: 'desc' },
  });

  const response: ApiResponse = { success: true, data: sessions };
  return c.json(response);
});

export { auth };
