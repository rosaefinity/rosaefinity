// =============================================
// RosaeFinity — Analytics Service
// =============================================

import { analyticsRepository } from './repository.js';

export const analyticsService = {
  async trackEvent(userId: string | undefined, data: { eventType: string; eventData: any; appVersion?: string; platform?: string; sessionId?: string }) {
    return analyticsRepository.createEvent({ userId, ...data });
  },

  async getDashboard() {
    const [eventCounts, versionDistribution, platformDistribution] = await Promise.all([
      analyticsRepository.getEventCounts(),
      analyticsRepository.getVersionDistribution(),
      analyticsRepository.getPlatformDistribution(),
    ]);

    return {
      eventCounts,
      versionDistribution,
      platformDistribution,
    };
  },

  async getEvents(eventType: string, limit = 100) {
    return analyticsRepository.getEventsByType(eventType, limit);
  },
};
