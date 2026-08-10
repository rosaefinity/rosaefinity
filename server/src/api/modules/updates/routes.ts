// =============================================
// RosaeFinity — Update Routes
// =============================================

import { Router } from 'express';
import { updateController } from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/check', (req, res, next) => updateController.check(req, res).catch(next));
router.post('/install', authenticate, (req, res, next) => updateController.recordInstall(req, res).catch(next));
router.get('/stats', authenticate, (req, res, next) => updateController.stats(req, res).catch(next));

export { router as updateRouter };
