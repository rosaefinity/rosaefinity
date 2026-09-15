// =============================================
// RosaeFinity — Auth Repository
// Data access layer for users and sessions.
// =============================================

import { getPrisma } from '../../../database/client.js';
import type { Prisma } from '@prisma/client';

const prisma = getPrisma();

export const authRepository = {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  async findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findUserByProvider(provider: string, providerId: string) {
    return prisma.user.findFirst({
      where: { authProvider: provider, providerId },
    });
  },

  async createUser(data: { email?: string; passwordHash?: string; displayName?: string; authProvider: string; providerId?: string; isAnonymous?: boolean }) {
    return prisma.user.create({ data });
  },

  async updateUser(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  },

  async updateUserPassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },

  async createSession(data: { userId: string; accessToken: string; refreshToken: string; deviceId?: string; ipAddress?: string; userAgent?: string; expiresAt: Date }) {
    return prisma.session.create({ data });
  },

  async findSessionByAccessToken(token: string) {
    return prisma.session.findUnique({ where: { accessToken: token } });
  },

  async findSessionByRefreshToken(token: string) {
    return prisma.session.findUnique({ where: { refreshToken: token } });
  },

  async updateSession(id: string, data: Prisma.SessionUpdateInput) {
    return prisma.session.update({ where: { id }, data });
  },

  async deleteSession(id: string) {
    return prisma.session.delete({ where: { id } });
  },

  async deleteAllUserSessions(userId: string) {
    return prisma.session.deleteMany({ where: { userId } });
  },

  async getUserSessions(userId: string) {
    return prisma.session.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });
  },
};
