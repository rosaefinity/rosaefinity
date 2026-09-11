// =============================================
// RosaeFinity Worker — Rate Limiter
// Per-IP rate limiting using in-memory counters.
//
// NOTE: Workers are stateless — counters reset between
// invocations. For stricter rate limiting, use Cloudflare
// Rate Limiting rules at the dashboard level or Workers KV.
// This provides basic protection against rapid-fire requests
// within a single Worker invocation.
// =============================================

import type { Context, Next } from 'hono';
import { RateLimitError } from './error-handler.js';

// Simple in-memory counter (resets per Worker invocation)
const counters = new Map<string, { count: number; resetAt: number }>();

function getClientIp(c: Context): string {
  return c.req.header('CF-Connecting-IP')
    || c.req.header('X-Forwarded-For')
    || c.req.header('X-Real-IP')
    || 'unknown';
}

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const entry = counters.get(key);

  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  return entry.count <= maxRequests;
}

/**
 * Global rate limiter middleware.
 */
export function rateLimiter(maxRequests = 100, windowMs = 900000) {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const key = `global:${ip}`;

    if (!checkRateLimit(key, maxRequests, windowMs)) {
      throw new RateLimitError();
    }

    await next();
  };
}

/**
 * Auth-specific rate limiter (stricter).
 */
export function authRateLimiter(maxRequests = 10, windowMs = 900000) {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const key = `auth:${ip}`;

    if (!checkRateLimit(key, maxRequests, windowMs)) {
      throw new RateLimitError('Too many authentication attempts');
    }

    await next();
  };
}

/**
 * Sync-specific rate limiter.
 */
export function syncRateLimiter(maxRequests = 30, windowMs = 60000) {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c);
    const key = `sync:${ip}`;

    if (!checkRateLimit(key, maxRequests, windowMs)) {
      throw new RateLimitError('Too many sync requests');
    }

    await next();
  };
}
