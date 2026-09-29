// =============================================
// RosaeFinity — Sync Repository
// =============================================

import { getPrisma } from '../../../database/client.js';
const prisma = getPrisma();

export const syncRepository = {
  async upsert(userId: string, entityType: string, entityId: string, data: any, version: number, checksum: string, operation = 'upsert') {
    // If operation is 'delete', create/update a tombstone instead of storing data
    if (operation === 'delete') {
      return this.delete(userId, entityType, entityId);
    }
    return prisma.syncRecord.upsert({
      where: { userId_entityType_entityId: { userId, entityType, entityId } },
      update: { data, version, checksum, operation, serverVersion: { increment: 1 }, isDeleted: false },
      create: { userId, entityType, entityId, data, version, checksum, operation, serverVersion: 1, isDeleted: false },
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
    // Soft-delete: mark as tombstone instead of hard-deleting
    // This allows other devices to discover the deletion via incremental pull
    return prisma.syncRecord.upsert({
      where: { userId_entityType_entityId: { userId, entityType, entityId } },
      update: {
        isDeleted: true,
        operation: 'delete',
        data: {},
        serverVersion: { increment: 1 },
      },
      create: {
        userId, entityType, entityId,
        data: {},
        operation: 'delete',
        isDeleted: true,
        version: 1,
        checksum: '',
        serverVersion: 1,
      },
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
