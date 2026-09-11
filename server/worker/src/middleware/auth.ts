// =============================================
// RosaeFinity Worker — Auth Middleware
// JWT verification using jose
// =============================================

import type { Context, Next } from 'hono';
import { verifyAccessToken } from '../jwt.js';
import { getConfig } from '../config.js';
import { UnauthorizedError, ForbiddenError } from './error-handler.js';
import type { JwtPayload } from '../types.js';
import type { AppEnv } from '../hono-types.js';

/**
 * Authenticate request via Bearer token.
 * Attaches decoded JWT payload to context as 'user'.
 */
export async function authenticate(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];
  const config = getConfig(c.env);

  try {
    const payload = await verifyAccessToken(token, config.JWT_SECRET);
    c.set('user', payload);
  } catch (err) {
    if (err instanceof Error && err.message.includes('expired')) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }

  await next();
}

/**
 * Require specific roles.
 * Must be used after authenticate middleware.
 */
export function requireRole(...roles: string[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      throw new UnauthorizedError();
    }

    if (!roles.includes(user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    await next();
  };
}
