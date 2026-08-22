// =============================================
// RosaeFinity — Auth Service
// Business logic for authentication.
// =============================================

import bcrypt from 'bcrypt';
import { authRepository } from './repository.js';
import { generateTokens, verifyRefreshToken } from '../../middleware/auth.js';
import { BadRequestError, UnauthorizedError, NotFoundError, ConflictError } from '../../middleware/error-handler.js';
import { generateId } from '../../../utils/helpers.js';

const BCRYPT_ROUNDS = 12;

export const authService = {
  async register(email: string, password: string, displayName?: string) {
    const existing = await authRepository.findUserByEmail(email);
    if (existing) throw new ConflictError('Email already registered');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await authRepository.createUser({
      email,
      passwordHash,
      displayName: displayName || email.split('@')[0],
      authProvider: 'email',
    });

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

    // Verify password with bcrypt
    if (!user.passwordHash) {
      // User registered via OAuth or guest - cannot login with email/password
      throw new UnauthorizedError('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) throw new UnauthorizedError('Invalid credentials');

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

  async getUserSessions(userId: string) {
    return authRepository.getUserSessions(userId);
  },
};
