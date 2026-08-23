// =============================================
// RosaeFinity — Admin Routes
// All routes require admin authentication.
// =============================================

import { Router } from 'express';
import { adminController } from './controller.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

const router = Router();

// Admin-only routes
router.use(authenticate);
router.use(requireRole('ADMIN'));

router.get('/dashboard', (req, res, next) => adminController.dashboard(req, res).catch(next));
router.get('/users', (req, res, next) => adminController.users(req, res).catch(next));
router.get('/users/:id', (req, res, next) => adminController.user(req, res).catch(next));
router.get('/audit', (req, res, next) => adminController.auditLogs(req, res).catch(next));
router.get('/health', (req, res, next) => adminController.health(req, res).catch(next));
router.post('/users/:id/extend', (req, res, next) => adminController.extendLicense(req, res).catch(next));
router.post('/users/:id/downgrade', (req, res, next) => adminController.downgradeUser(req, res).catch(next));
router.post('/users/:id/activate', (req, res, next) => {
  console.log('[ADMIN ACTIVATE ROUTE HIT]', { method: req.method, url: req.originalUrl, params: req.params });
  adminController.activateUser(req, res).catch(next);
});

export { router as adminRouter };
