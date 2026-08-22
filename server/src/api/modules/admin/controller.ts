// =============================================
// RosaeFinity — Admin Controller
// =============================================

import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '../../../types/index.js';
import { adminService } from './service.js';

export const adminController = {
  async dashboard(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = await adminService.getDashboard();
    const response: ApiResponse = { success: true, data };
    res.json(response);
  },

  async users(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await adminService.getUsers(page, limit);
    const response: ApiResponse = { success: true, data: data.users, pagination: { page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages } };
    res.json(response);
  },

  async user(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = req.params.id as string;
    const data = await adminService.getUser(id);
    const response: ApiResponse = { success: true, data };
    res.json(response);
  },

  async auditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const data = await adminService.getAuditLogs(page, limit);
    const response: ApiResponse = { success: true, data: data.logs, pagination: { page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages } };
    res.json(response);
  },

  async health(_req: AuthenticatedRequest, res: Response): Promise<void> {
    const data = await adminService.getHealth();
    const statusCode = data.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({ success: true, data });
  },

  async extendLicense(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = req.params.id as string;
    const days = Number(req.body?.days) || 30;
    const data = await adminService.extendLicense(id, days);
    const response: ApiResponse = { success: true, data };
    res.json(response);
  },

  async downgradeUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = req.params.id as string;
    const data = await adminService.downgradeUser(id);
    const response: ApiResponse = { success: true, data };
    res.json(response);
  },
};
