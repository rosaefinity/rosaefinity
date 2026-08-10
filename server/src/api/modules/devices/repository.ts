// =============================================
// RosaeFinity — Device Repository
// =============================================

import { getPrisma } from '../../../database/client.js';
const prisma = getPrisma();

export const deviceRepository = {
  async findByDeviceId(deviceId: string) {
    return prisma.device.findUnique({ where: { deviceId } });
  },

  async findByUserId(userId: string) {
    return prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  },

  async create(data: { userId: string; deviceId: string; name: string; platform: string; appVersion?: string; machineFingerprint?: string }) {
    return prisma.device.create({ data });
  },

  async update(id: string, data: any) {
    return prisma.device.update({ where: { id }, data });
  },

  async deactivate(id: string) {
    return prisma.device.update({ where: { id }, data: { status: 'inactive' } });
  },

  async revoke(id: string) {
    return prisma.device.update({ where: { id }, data: { status: 'revoked' } });
  },

  async touchLastSeen(deviceId: string) {
    return prisma.device.update({
      where: { deviceId },
      data: { lastSeenAt: new Date() },
    }).catch(() => null); // Ignore if not found
  },

  async countActiveByUserId(userId: string) {
    return prisma.device.count({ where: { userId, status: 'active' } });
  },
};
