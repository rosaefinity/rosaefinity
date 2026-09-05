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

    // Log ALL licenses for diagnostic tracing
    console.log('[ADMIN USER DETAIL] ALL licenses for user:', JSON.stringify(
      (data.licenses || []).map((l: any) => ({
        id: l.id, planId: l.planId, status: l.status,
        expiresAt: l.expiresAt?.toISOString(), createdAt: l.createdAt?.toISOString(),
      }))
    ));

    // Select the canonical license using the same logic as downgradeUser/extendLicense
    // Priority: active/grace with future expiry > active/grace > most recent revoked/expired > null
    const now = new Date();
    const activeLicense =
      // Most recent active/grace with future expiry
      data.licenses?.find((l: any) =>
        (l.status === 'active' || l.status === 'grace') &&
        l.expiresAt && new Date(l.expiresAt).getTime() > now.getTime()
      ) ??
      // Most recent active/grace (grace period, expired but still valid)
      data.licenses?.find((l: any) => l.status === 'active' || l.status === 'grace') ??
      // Most recent revoked/expired (for reactivation info)
      data.licenses?.[0] ??
      null;

    console.log('[ADMIN USER DETAIL] selected license:', activeLicense ? {
      id: activeLicense.id, status: activeLicense.status,
      expiresAt: activeLicense.expiresAt?.toISOString(),
    } : 'none');
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
    console.log('========== LICENSE RUNTIME MARKER 2026-09-03 ==========');
    console.log('EXECUTING FILE: server/src/api/modules/admin/controller.ts');
    console.log('PROCESS PID:', process.pid);
    console.log('CWD:', process.cwd());
    console.log('REQUEST:', {
      method: req.method,
      url: req.originalUrl,
      params: req.params,
      body: req.body,
    });
    console.log('=======================================================');

    const id = req.params.id as string;
    const days = Number(req.body?.days) || 30;
    const serverNow = new Date();

    console.log('[LICENSE TRACE] CONTROLLER -> EXTEND SERVICE');
    console.log('[LICENSE TRACE] User ID:', id);
    console.log('[LICENSE TRACE] Days:', days);
    console.log('[LICENSE TRACE] Server NOW:', serverNow.toISOString());

    const data = await adminService.extendLicense(id, days);

    console.log('[LICENSE TRACE] CONTROLLER RECEIVED FROM SERVICE:', JSON.stringify(data));

    const response: ApiResponse = { success: true, data };

    console.log('[LICENSE TRACE] FINAL RESPONSE TO FRONTEND:', JSON.stringify(response));

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
    let body;
    try {
      body = adminActivateSchema.parse(req.body);
    } catch (err: unknown) {
      const zodErr = err as { issues?: Array<{ message: string; path: (string | number)[] }> };
      const msg = zodErr.issues?.map(i => `${i.path.join('.')}: ${i.message}`).join(', ') || 'Invalid request body';
      console.error('[ADMIN-ACTIVATE] VALIDATION ERROR:', msg, 'body:', JSON.stringify(req.body));
      res.status(400).json({ success: false, error: msg, code: 'VALIDATION_ERROR' });
      return;
    }
    console.log('[ADMIN-ACTIVATE] userId:', id, 'plan:', body.plan, 'durationDays:', body.durationDays);
    const data = await adminService.activateForUser(id, body.plan, body.durationDays);
    const response: ApiResponse = { success: true, data };
    res.json(response);
  },
};
