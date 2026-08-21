// =============================================
// RosaeFinity Server — Auth Middleware
// JWT verification, request authentication.
// =============================================

import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../config/index.js';
import type { AuthenticatedRequest, JwtPayload } from '../../types/index.js';
import { UnauthorizedError } from './error-handler.js';

export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or invalid authorization header'));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const config = getConfig();
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(new UnauthorizedError('Invalid token'));
    }
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!roles.includes(req.user.planTier) && !roles.includes((req.user as any).role)) {
      next(new UnauthorizedError('Insufficient permissions'));
      return;
    }

    next();
  };
}

export function generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp'>): { accessToken: string; refreshToken: string } {
  const config = getConfig();

  const accessToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.JWT_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES_IN },
  );

  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token: string): JwtPayload {
  const config = getConfig();
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}
