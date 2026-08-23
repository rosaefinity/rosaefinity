// =============================================
// RosaeFinity — Auth Routes
// POST /api/v1/auth/*
// =============================================

import { Router } from 'express';
import { authController } from './controller.js';
import { authenticate } from '../../middleware/auth.js';
import { authRateLimiter } from '../../middleware/rate-limiter.js';

const router = Router();

// Public routes (with auth rate limiting)
router.post('/register', authRateLimiter, (req, res, next) => authController.register(req, res).catch(next));
router.post('/login', authRateLimiter, (req, res, next) => authController.login(req, res).catch(next));
router.post('/login/google', authRateLimiter, (req, res, next) => authController.loginGoogle(req, res).catch(next));
router.post('/login/guest', authRateLimiter, (req, res, next) => authController.loginGuest(req, res).catch(next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res).catch(next));

// Protected routes
router.post('/logout', authenticate, (req, res, next) => authController.logout(req, res).catch(next));
router.post('/logout-all', authenticate, (req, res, next) => authController.logoutAll(req, res).catch(next));
router.get('/me', authenticate, (req, res, next) => authController.me(req, res).catch(next));
router.get('/subscription', authenticate, (req, res, next) => authController.subscription(req, res).catch(next));
router.get('/sessions', authenticate, (req, res, next) => authController.sessions(req, res).catch(next));

export { router as authRouter };
