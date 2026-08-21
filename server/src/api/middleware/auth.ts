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

  // Convert string expiresIn to number (seconds)
  const accessExpiresIn = parseExpiresIn(config.JWT_EXPIRES_IN);
  const refreshExpiresIn = parseExpiresIn(config.JWT_REFRESH_EXPIRES_IN);

  const accessToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: accessExpiresIn,
  });

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.JWT_SECRET,
    { expiresIn: refreshExpiresIn },
  );

  return { accessToken, refreshToken };
}

function parseExpiresIn(value: string): number {
  // Parse "15m", "7d", "1h", etc. to seconds
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // default 15 minutes
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return 900;
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  const config = getConfig();
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}
