// =============================================
// RosaeFinity Worker — Request ID Middleware
// Adds unique request ID to every request.
// =============================================

import type { Context, Next } from 'hono';
import { generateId } from '../crypto.js';

export async function requestId(c: Context, next: Next) {
  const id = c.req.header('X-Request-Id') || generateId();
  c.set('requestId', id);
  c.header('X-Request-Id', id);
  await next();
}
