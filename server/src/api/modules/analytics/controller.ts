// =============================================
// RosaeFinity — Analytics Controller
// =============================================

import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '../../../types/index.js';
import { analyticsService } from './service.js';
import { analyticsEventSchema } from '../../../validation/schemas.js';

export const analyticsController = {
  async track(req: AuthenticatedRequest, res: Response): Promise<void> {
    const body = analyticsEventSchema.parse(req.body);
    await analyticsService.trackEvent(req.user?.sub, body);
    const response: ApiResponse = { success: true };
    res.json(response);
  },

  async dashboard(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = await analyticsService.getDashboard();
    const response: ApiResponse = { success: true, data };
    res.json(response);
  },

  async events(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { eventType, limit } = req.query;
    const events = await analyticsService.getEvents(eventType as string, Number(limit) || 100);
    const response: ApiResponse = { success: true, data: events };
    res.json(response);
  },
};
