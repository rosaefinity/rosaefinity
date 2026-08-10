// =============================================
// RosaeFinity — Auth Controller
// Handles HTTP requests for authentication.
// =============================================

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../../types/index.js';
import { authService } from './service.js';
import { registerSchema, loginSchema, refreshSchema } from '../../../validation/schemas.js';
import type { ApiResponse } from '../../../types/index.js';

export const authController = {
  async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body.email, body.password, body.displayName);
    const response: ApiResponse = { success: true, data: result };
    res.status(201).json(response);
  },

  async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body.email, body.password, body.rememberMe);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async loginGoogle(req: AuthenticatedRequest, res: Response): Promise<void> {
    // In production: verify Google token with Supabase
    const { accessToken, idToken } = req.body;
    const result = await authService.loginWithProvider('google', accessToken, undefined, undefined);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async loginGuest(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await authService.loginAsGuest();
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async refresh(req: AuthenticatedRequest, res: Response): Promise<void> {
    const body = refreshSchema.parse(req.body);
    const result = await authService.refresh(body.refreshToken);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    const token = req.headers.authorization?.split(' ')[1] || '';
    const result = await authService.logout(token);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async logoutAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const result = await authService.logoutAll(req.user.sub);
    const response: ApiResponse = { success: true, data: result };
    res.json(response);
  },

  async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const user = await authService.getCurrentUser(req.user.sub);
    const response: ApiResponse = { success: true, data: user };
    res.json(response);
  },

  async sessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const sessions = await authService.getUserSessions(req.user.sub);
    const response: ApiResponse = { success: true, data: sessions };
    res.json(response);
  },
};
