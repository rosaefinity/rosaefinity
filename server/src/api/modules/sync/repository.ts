// =============================================
// RosaeFinity — Sync Repository
// =============================================

import { getPrisma } from '../../../database/client.js';
const prisma = getPrisma();

export const syncRepository = {
  async upsert(userId: string, entityType: string, entityId: string, data: any, version: number, checksum: string) {
    return prisma.syncRecord.upsert({
      where: { userId_entityType_entityId: { userId, entityType, entityId } },
      update: { data, version, checksum, serverVersion: { increment: 1 } },
      create: { userId, entityType, entityId, data, version, checksum, serverVersion: 1 },
    });
  },

  async findChanged(userId: string, entityType?: string, sinceVersion = 0) {
    const where: any = { userId, serverVersion: { gt: sinceVersion } };
    if (entityType) where.entityType = entityType;
    return prisma.syncRecord.findMany({
      where,
      orderBy: { serverVersion: 'asc' },
      take: 500,
    });
  },

  async findAll(userId: string, entityType?: string) {
    const where: any = { userId };
    if (entityType) where.entityType = entityType;
    return prisma.syncRecord.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  },

  async delete(userId: string, entityType: string, entityId: string) {
    return prisma.syncRecord.deleteMany({
      where: { userId, entityType, entityId },
    });
  },

  async getMaxServerVersion(userId: string) {
    const result = await prisma.syncRecord.aggregate({
      where: { userId },
      _max: { serverVersion: true },
    });
    return result._max.serverVersion || 0;
  },
};
