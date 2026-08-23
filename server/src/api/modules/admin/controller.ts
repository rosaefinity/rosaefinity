// =============================================
// RosaeFinity — Admin Controller
// =============================================

import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '../../../types/index.js';
import { adminService } from './service.js';
import { adminActivateSchema } from '../../../validation/schemas.js';

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
    if (!data) {
      res.status(404).json({ success: false, error: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    // Reshape to match frontend UserDetail type
    const activeLicense = data.licenses?.find((l: { status: string }) => l.status === 'active') ?? data.licenses?.[0] ?? null;
    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: data.id,
          email: data.email,
          name: data.displayName ?? data.email?.split('@')[0] ?? 'Unknown',
          role: data.role,
          created_at: data.createdAt,
        },
        license: activeLicense
          ? {
              id: activeLicense.id,
              user_id: activeLicense.userId,
              plan: activeLicense.planId,
              status: activeLicense.status,
              expires_at: activeLicense.expiresAt,
              created_at: activeLicense.createdAt,
              updated_at: activeLicense.updatedAt,
            }
          : null,
        devices: data.devices ?? [],
        payments: [],
        activations: (data.sessions ?? []).map((s: { id: string; createdAt: unknown; lastActiveAt: unknown }) => ({
          id: s.id,
          created_at: s.lastActiveAt ?? s.createdAt,
          action: 'session',
          performed_by: 'system',
        })),
      },
    };
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

  async activateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = req.params.id as string;
    const body = adminActivateSchema.parse(req.body);
    console.log('[ADMIN-ACTIVATE] userId:', id, 'plan:', body.plan, 'durationDays:', body.durationDays);
    const data = await adminService.activateForUser(id, body.plan, body.durationDays);
    const response: ApiResponse = { success: true, data };
    res.json(response);
  },
};
