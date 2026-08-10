// =============================================
// RosaeFinity — Sync Controller
// =============================================

import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '../../../types/index.js';
import { syncService } from './service.js';
import { syncBatchSchema, syncPullSchema } from '../../../validation/schemas.js';

export const syncController = {
  async push(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const body = syncBatchSchema.parse(req.body);
    const result = await syncService.push(req.user.sub, body.records, body.clientVersion);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async pull(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const query = syncPullSchema.parse(req.query);
    const result = await syncService.pull(req.user.sub, query.entityType, query.sinceVersion, query.limit);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { entityType, entityId } = req.body;
    const result = await syncService.delete(req.user.sub, entityType, entityId);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async version(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const version = await syncService.getServerVersion(req.user.sub);
    const response: ApiResponse = { success: true, data: { serverVersion: version } };
    res.json(response);
  },
};
