// =============================================
// RosaeFinity — Device Routes
// =============================================

import { Router } from 'express';
import { deviceController } from './controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/register', authenticate, (req, res, next) => deviceController.register(req, res).catch(next));
router.get('/', authenticate, (req, res, next) => deviceController.list(req, res).catch(next));
router.post('/deactivate', authenticate, (req, res, next) => deviceController.deactivate(req, res).catch(next));
router.post('/rename', authenticate, (req, res, next) => deviceController.rename(req, res).catch(next));
router.post('/heartbeat', authenticate, (req, res, next) => deviceController.heartbeat(req, res).catch(next));

export { router as deviceRouter };
