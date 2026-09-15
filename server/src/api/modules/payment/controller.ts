// =============================================
// RosaeFinity — Payment Controller
// =============================================

import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '../../../types/index.js';
import { paymentService } from './service.js';
import { submitPaymentSchema, rejectPaymentSchema } from '../../../validation/schemas.js';

export const paymentController = {
  /** POST /payment/submit — User creates a pending payment */
  async submit(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const body = submitPaymentSchema.parse(req.body);
    const payment = await paymentService.submitPayment(
      req.user.sub,
      body.amount,
      body.paymentMethod,
      body.proofUrl,
    );
    const response: ApiResponse = { success: true, data: payment };
    res.status(201).json(response);
  },

  /** GET /payment/my — User's own payment history */
  async myPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const payments = await paymentService.getUserPayments(req.user.sub);
    const response: ApiResponse = { success: true, data: payments };
    res.json(response);
  },

  /** GET /payment/pending — Admin: list pending payments */
  async listPending(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const data = await paymentService.getPendingPayments(page, limit);
    const response: ApiResponse = {
      success: true,
      data: data.payments,
      pagination: { page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages },
    };
    res.json(response);
  },

  /** GET /payment/all — Admin: list all payments */
  async listAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string | undefined;
    const data = await paymentService.getAllPayments(page, limit, status);
    const response: ApiResponse = {
      success: true,
      data: data.payments,
      pagination: { page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages },
    };
    res.json(response);
  },

  /** GET /payment/:id — Get single payment detail */
  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = req.params.id as string;
    const payment = await paymentService.getPaymentById(id);
    if (!payment || payment.userId !== req.user?.sub) {
      res.status(404).json({ success: false, error: 'Payment not found' });
      return;
    }
    const response: ApiResponse = { success: true, data: payment };
    res.json(response);
  },

  /** POST /payment/:id/approve — Admin: approve payment and activate Pro */
  async approve(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const id = req.params.id as string;
    const payment = await paymentService.approvePayment(id, req.user.sub);
    const response: ApiResponse = { success: true, data: payment };
    res.json(response);
  },

  /** POST /payment/:id/reject — Admin: reject payment */
  async reject(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const id = req.params.id as string;
    const body = rejectPaymentSchema.parse(req.body);
    const payment = await paymentService.rejectPayment(id, req.user.sub, body.notes);
    const response: ApiResponse = { success: true, data: payment };
    res.json(response);
  },
};
