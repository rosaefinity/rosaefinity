// =============================================
// RosaeFinity — Analytics Routes
// =============================================

import { Router } from 'express';
import { analyticsController } from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/track', (req, res, next) => analyticsController.track(req, res).catch(next));
router.get('/dashboard', authenticate, (req, res, next) => analyticsController.dashboard(req, res).catch(next));
router.get('/events', authenticate, (req, res, next) => analyticsController.events(req, res).catch(next));

export { router as analyticsRouter };
