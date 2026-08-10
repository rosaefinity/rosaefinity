// =============================================
// RosaeFinity — License Routes
// =============================================

import { Router } from 'express';
import { licenseController } from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/activate', authenticate, (req, res, next) => licenseController.activate(req, res).catch(next));
router.post('/deactivate', authenticate, (req, res, next) => licenseController.deactivate(req, res).catch(next));
router.get('/status', authenticate, (req, res, next) => licenseController.status(req, res).catch(next));
router.get('/plans', (req, res, next) => licenseController.plans(req, res).catch(next));

export { router as licenseRouter };
