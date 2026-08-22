// =============================================
// RosaeFinity — Auth Middleware Tests
// =============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mock getConfig before importing auth middleware
vi.mock('../../../config/index.js', () => ({
  getConfig: () => ({
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long-for-jwt',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  }),
}));

import { authenticate, requireRole } from '../auth.js';
import { ForbiddenError, UnauthorizedError } from '../error-handler.js';

function mockReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function nextFn(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

const TEST_SECRET = 'test-secret-key-that-is-at-least-32-chars-long-for-jwt';

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
}

describe('authenticate middleware', () => {
  it('rejects missing authorization header', () => {
    const req = mockReq();
    const res = mockRes();
    const next = nextFn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rejects non-Bearer token', () => {
    const req = mockReq('Basic abc123');
    const res = mockRes();
    const next = nextFn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('rejects expired token', () => {
    const token = signToken({ sub: '1', email: 'test@test.com', planTier: 'free', role: 'USER', iat: Math.floor(Date.now() / 1000) - 7200 });
    // Create an already-expired token
    const expiredToken = jwt.sign(
      { sub: '1', email: 'test@test.com', planTier: 'free', role: 'USER' },
      TEST_SECRET,
      { expiresIn: '-1h' }
    );
    const req = mockReq(`Bearer ${expiredToken}`);
    const res = mockRes();
    const next = nextFn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('passes valid token and attaches user to request', () => {
    const token = signToken({ sub: 'user-1', email: 'test@test.com', planTier: 'free', role: 'USER' });
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = nextFn();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect((req as any).user).toBeDefined();
    expect((req as any).user.sub).toBe('user-1');
    expect((req as any).user.role).toBe('USER');
  });
});

describe('requireRole middleware', () => {
  function authReq(role: string): Request {
    const token = signToken({ sub: '1', email: 'test@test.com', planTier: 'free', role });
    return mockReq(`Bearer ${token}`);
  }

  function passThroughAuth(req: Request): void {
    const res = mockRes();
    const next = nextFn();
    authenticate(req, res, next);
  }

  it('passes when user has matching role', () => {
    const req = authReq('ADMIN');
    passThroughAuth(req);
    const res = mockRes();
    const next = nextFn();
    requireRole('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes when user has one of multiple required roles', () => {
    const req = authReq('USER');
    passThroughAuth(req);
    const res = mockRes();
    const next = nextFn();
    requireRole('ADMIN', 'USER')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('returns 403 when user lacks required role', () => {
    const req = authReq('USER');
    passThroughAuth(req);
    const res = mockRes();
    const next = nextFn();
    requireRole('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('returns 401 when no user is authenticated', () => {
    const req = mockReq();
    const res = mockRes();
    const next = nextFn();
    requireRole('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('does NOT pass based on planTier alone (enterprise != ADMIN)', () => {
    const token = signToken({ sub: '1', email: 'test@test.com', planTier: 'enterprise', role: 'USER' });
    const req = mockReq(`Bearer ${token}`);
    passThroughAuth(req);
    const res = mockRes();
    const next = nextFn();
    requireRole('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
