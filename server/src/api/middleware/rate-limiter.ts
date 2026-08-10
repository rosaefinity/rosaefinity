// =============================================
// RosaeFinity Server — Rate Limiter Middleware
// Per-IP and per-user rate limiting.
// =============================================

import type { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { getConfig } from '../../config/index.js';
import { RateLimitError } from './error-handler.js';

// Global rate limiter (per IP)
const globalLimiter = new RateLimiterMemory({
  points: 100,
  duration: 15 * 60, // 15 minutes
});

// Auth rate limiter (stricter)
const authLimiter = new RateLimiterMemory({
  points: 10,
  duration: 15 * 60, // 15 minutes
});

// Sync rate limiter
const syncLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60, // 1 minute
});

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    await globalLimiter.consume(key);
    next();
  } catch {
    next(new RateLimitError());
  }
}

export async function authRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = `auth:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    await authLimiter.consume(key);
    next();
  } catch {
    next(new RateLimitError('Too many authentication attempts'));
  }
}

export async function syncRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = `sync:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    await syncLimiter.consume(key);
    next();
  } catch {
    next(new RateLimitError('Too many sync requests'));
  }
}
