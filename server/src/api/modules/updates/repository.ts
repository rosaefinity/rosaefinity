// =============================================
// RosaeFinity — Update Repository
// =============================================

import { getPrisma } from '../../../database/client.js';
const prisma = getPrisma();

export const updateRepository = {
  async recordUpdate(data: { userId?: string; fromVersion: string; toVersion: string; channel: string; status: string; platform?: string; appVersion?: string }) {
    return prisma.updateHistory.create({ data });
  },

  async getRecentUpdates(limit = 50) {
    return prisma.updateHistory.findMany({
      orderBy: { installedAt: 'desc' },
      take: limit,
    });
  },

  async getUpdateStats() {
    const total = await prisma.updateHistory.count();
    const successful = await prisma.updateHistory.count({ where: { status: 'installed' } });
    const failed = await prisma.updateHistory.count({ where: { status: 'failed' } });
    return { total, successful, failed, successRate: total > 0 ? (successful / total * 100).toFixed(1) : '0' };
  },
};
