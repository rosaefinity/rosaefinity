// =============================================
// RosaeFinity — Payment Routes
// =============================================

import { Router } from 'express';
import { paymentController } from './controller.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const router = Router();

// ── User routes (authenticated) ──
router.post('/submit', authenticate, (req, res, next) => paymentController.submit(req, res).catch(next));
router.get('/my', authenticate, (req, res, next) => paymentController.myPayments(req, res).catch(next));

// ── Admin routes ──
router.get('/pending', authenticate, requireRole('ADMIN'), (req, res, next) => paymentController.listPending(req, res).catch(next));
router.get('/all', authenticate, requireRole('ADMIN'), (req, res, next) => paymentController.listAll(req, res).catch(next));
router.get('/:id', authenticate, (req, res, next) => paymentController.getById(req, res).catch(next));
router.post('/:id/approve', authenticate, requireRole('ADMIN'), (req, res, next) => paymentController.approve(req, res).catch(next));
router.post('/:id/reject', authenticate, requireRole('ADMIN'), (req, res, next) => paymentController.reject(req, res).catch(next));

export { router as paymentRouter };
