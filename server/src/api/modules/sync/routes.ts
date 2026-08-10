// =============================================
// RosaeFinity — Sync Routes
// =============================================

import { Router } from 'express';
import { syncController } from './controller.js';
import { authenticate } from '../../middleware/auth.js';
import { syncRateLimiter } from '../../middleware/rate-limiter.js';

const router = Router();

router.post('/push', authenticate, syncRateLimiter, (req, res, next) => syncController.push(req, res).catch(next));
router.get('/pull', authenticate, (req, res, next) => syncController.pull(req, res).catch(next));
router.post('/delete', authenticate, (req, res, next) => syncController.delete(req, res).catch(next));
router.get('/version', authenticate, (req, res, next) => syncController.version(req, res).catch(next));

export { router as syncRouter };
