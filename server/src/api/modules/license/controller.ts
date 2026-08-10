// =============================================
// RosaeFinity — License Controller
// =============================================

import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '../../../types/index.js';
import { licenseService } from './service.js';
import { activateLicenseSchema } from '../../../validation/schemas.js';

export const licenseController = {
  async activate(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const body = activateLicenseSchema.parse(req.body);
    const result = await licenseService.activate(req.user.sub, body.licenseKey, body.deviceId, body.email);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async deactivate(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { deviceId } = req.body;
    const result = await licenseService.deactivate(req.user.sub, deviceId);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async status(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const result = await licenseService.getStatus(req.user.sub);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async plans(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const plans = await licenseService.getAllPlans();
    const response: ApiResponse = { success: true, data: plans };
    res.json(response);
  },
};
