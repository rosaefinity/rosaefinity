// =============================================
// RosaeFinity — Device Controller
// =============================================

import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '../../../types/index.js';
import { deviceService } from './service.js';
import { registerDeviceSchema } from '../../../validation/schemas.js';

export const deviceController = {
  async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const body = registerDeviceSchema.parse(req.body);
    const device = await deviceService.register(req.user.sub, body);
    const response: ApiResponse = { success: true, data: device };
    res.json(response);
  },

  async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const devices = await deviceService.list(req.user.sub);
    const response: ApiResponse = { success: true, data: devices };
    res.json(response);
  },

  async deactivate(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { deviceId } = req.body;
    const result = await deviceService.deactivate(req.user.sub, deviceId);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async rename(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { deviceId, name } = req.body;
    const result = await deviceService.rename(req.user.sub, deviceId, name);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async heartbeat(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { deviceId } = req.body;
    await deviceService.touch(deviceId);
    const response: ApiResponse = { success: true };
    res.json(response);
  },
};
