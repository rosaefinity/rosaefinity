// =============================================
// RosaeFinity — Analytics Repository
// =============================================

import { getPrisma } from '../../../database/client.js';
const prisma = getPrisma();

export const analyticsRepository = {
  async createEvent(data: { userId?: string; eventType: string; eventData: any; appVersion?: string; platform?: string; sessionId?: string }) {
    return prisma.analyticsEvent.create({ data });
  },

  async getEventsByType(eventType: string, limit = 100) {
    return prisma.analyticsEvent.findMany({
      where: { eventType },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async getEventCounts() {
    const results = await prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      _count: true,
    });
    return results.map((r: { eventType: string; _count: number }) => ({ eventType: r.eventType, count: r._count }));
  },

  async getVersionDistribution() {
    const results = await prisma.analyticsEvent.groupBy({
      by: ['appVersion'],
      _count: true,
      where: { appVersion: { not: null } },
    });
    return results.map((r: { appVersion: string | null; _count: number }) => ({ version: r.appVersion, count: r._count }));
  },

  async getPlatformDistribution() {
    const results = await prisma.analyticsEvent.groupBy({
      by: ['platform'],
      _count: true,
      where: { platform: { not: null } },
    });
    return results.map((r: { platform: string | null; _count: number }) => ({ platform: r.platform, count: r._count }));
  },
};
