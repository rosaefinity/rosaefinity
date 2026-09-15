// =============================================
// RosaeFinity — Auth Service
// Business logic for authentication.
// =============================================

import bcrypt from 'bcrypt';
import { authRepository } from './repository.js';
import { generateTokens, verifyRefreshToken } from '../../middleware/auth.js';
import { BadRequestError, UnauthorizedError, NotFoundError, ConflictError } from '../../middleware/error-handler.js';
import { generateId } from '../../../utils/helpers.js';
import { hashPassword, verifyPassword } from '../../../utils/password.js';

export const authService = {
  async register(email: string, password: string, displayName?: string) {
    const existing = await authRepository.findUserByEmail(email);
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await hashPassword(password);

    const user = await authRepository.createUser({
      email,
      passwordHash,
      displayName: displayName || email.split('@')[0],
      authProvider: 'email',
    });

    console.log('[AUTH] Creating new user', JSON.stringify({
      userId: user.id,
      email: user.email,
      accountType: user.accountType,
      defaultPlan: 'FREE',
      hasLicense: false,
      expiresAt: null,
    }));

    const tokens = generateTokens({
      sub: user.id,
      email: user.email || '',
      planTier: user.accountType,
      role: user.role || 'USER',
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await authRepository.createSession({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
    });

    // Strip sensitive fields from response
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  },

  async login(email: string, password: string, rememberMe = false) {
    const user = await authRepository.findUserByEmail(email);
    if (!user) throw new UnauthorizedError('Invalid credentials');

    // Verify password with dual-format support (bcrypt legacy + scrypt)
    if (!user.passwordHash) {
      // User registered via OAuth or guest - cannot login with email/password
      throw new UnauthorizedError('Invalid credentials');
    }

    const { verified, needsMigration } = await verifyPassword(password, user.passwordHash);
    if (!verified) throw new UnauthorizedError('Invalid credentials');

    // If the password was verified but needs migration (legacy bcrypt), re-hash to scrypt
    if (needsMigration) {
      const newHash = await hashPassword(password);
      await authRepository.updateUserPassword(user.id, newHash);
    }

    const tokens = generateTokens({
      sub: user.id,
      email: user.email || '',
      planTier: user.accountType,
      role: user.role || 'USER',
    });

    const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000);
    await authRepository.createSession({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
    });

    // Strip sensitive fields from response
    const { passwordHash: _ph, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  },

  async loginWithProvider(provider: string, providerId: string, email?: string, displayName?: string) {
    let user = await authRepository.findUserByProvider(provider, providerId);

    if (!user) {
      user = await authRepository.createUser({
        email,
        displayName,
        authProvider: provider,
        providerId,
      });
    }

    const tokens = generateTokens({
      sub: user.id,
      email: user.email || '',
      planTier: user.accountType,
      role: user.role || 'USER',
    });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await authRepository.createSession({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
    });

    return { user, ...tokens };
  },

  async loginAsGuest() {
    const user = await authRepository.createUser({
      authProvider: 'anonymous',
      isAnonymous: true,
      displayName: `Guest-${generateId().substring(0, 6)}`,
    });

    const tokens = generateTokens({
      sub: user.id,
      email: '',
      planTier: 'guest',
      role: 'USER',
    });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await authRepository.createSession({
      userId: user.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
    });

    return { user, ...tokens };
  },

  async refresh(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const session = await authRepository.findSessionByRefreshToken(refreshToken);
      if (!session) throw new UnauthorizedError('Invalid refresh token');

      const user = await authRepository.findUserById(payload.sub);
      if (!user) throw new UnauthorizedError('User not found');

      const tokens = generateTokens({
        sub: user.id,
        email: user.email || '',
        planTier: user.accountType,
        role: user.role || 'USER',
      });

      // Replace old session
      await authRepository.deleteSession(session.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await authRepository.createSession({
        userId: user.id,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
      });

      return { user, ...tokens };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  },

  async logout(sessionToken: string) {
    const session = await authRepository.findSessionByAccessToken(sessionToken);
    if (session) {
      await authRepository.deleteSession(session.id);
    }
    return { success: true };
  },

  async logoutAll(userId: string) {
    await authRepository.deleteAllUserSessions(userId);
    return { success: true };
  },

  async getCurrentUser(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) throw new NotFoundError('User not found');
    // Strip sensitive fields from response
    const { passwordHash: _ph, ...safeUser } = user;
    return safeUser;
  },

  /** Get the user's current subscription/entitlements from their licenses */
  async getSubscription(userId: string) {
    const prisma = (await import('../../../database/client.js')).getPrisma();

    // Find the most recent active (or grace) PRO license
    const license = await prisma.license.findFirst({
      where: { userId, planId: 'pro', status: { in: ['active', 'grace'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = Date.now();
    const isPro = license != null && (!license.expiresAt || license.expiresAt.getTime() > now);

    console.log('[ENTITLEMENT] Resolved', JSON.stringify({
      userId,
      hasLicense: !!license,
      licenseStatus: license?.status ?? 'none',
      licensePlan: license?.planId ?? 'none',
      expiresAt: license?.expiresAt?.toISOString() ?? 'null',
      isPro,
      plan: isPro ? 'pro' : 'free',
      timestamp: new Date().toISOString(),
    }));

    const plan = isPro ? 'pro' : 'free';
    const status = isPro ? 'active' : 'free';
    const features = isPro && license?.plan
      ? {
          maxActions: null as number | null, // null = unlimited
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
  },

  async getUserSessions(userId: string) {
    return authRepository.getUserSessions(userId);
  },
};
