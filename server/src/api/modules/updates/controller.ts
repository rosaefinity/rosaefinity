// =============================================
// RosaeFinity — Update Controller
// =============================================

import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '../../../types/index.js';
import { updateService } from './service.js';
import { checkUpdateSchema } from '../../../validation/schemas.js';

export const updateController = {
  async check(req: AuthenticatedRequest, res: Response): Promise<void> {
    const body = checkUpdateSchema.parse(req.body);
    const result = await updateService.checkForUpdate(body.currentVersion, body.channel);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async recordInstall(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { fromVersion, toVersion, channel, platform } = req.body;
    const userId = req.user?.sub;
    await updateService.recordInstall(userId, fromVersion, toVersion, channel, platform);
    const response: ApiResponse = { success: true };
    res.json(response);
  },

  async stats(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const stats = await updateService.getStats();
    const response: ApiResponse = { success: true, data: stats };
    res.json(response);
  },
};
