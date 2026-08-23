// =============================================
// RosaeFinity — Admin Repository
// =============================================

import { getPrisma } from '../../../database/client.js';
const prisma = getPrisma();

export const adminRepository = {
  async getDashboardStats() {
    const [totalUsers, activeLicenses, totalDevices, totalSyncRecords, recentUpdates] = await Promise.all([
      prisma.user.count(),
      prisma.license.count({ where: { status: 'active' } }),
      prisma.device.count(),
      prisma.syncRecord.count(),
      prisma.updateHistory.count({ where: { installedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    ]);

    return { totalUsers, activeLicenses, totalDevices, totalSyncRecords, recentUpdates };
  },

  async getUsers(page = 1, limit = 20) {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          licenses: {
            orderBy: { createdAt: 'desc' },
            include: { plan: true },
          },
        },
      }),
      prisma.user.count(),
    ]);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        devices: true,
        licenses: { include: { plan: true } },
        sessions: { orderBy: { lastActiveAt: 'desc' }, take: 10 },
      },
    });
  },

  async getAuditLogs(page = 1, limit = 50) {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count(),
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getHealth() {
    const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    return {
      status: dbOk ? 'healthy' : 'degraded',
      database: dbOk ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  },
};
