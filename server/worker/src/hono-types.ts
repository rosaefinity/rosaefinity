// =============================================
// RosaeFinity Worker — Centralized Hono Types
// Shared Variables type for all Hono routes
// =============================================

import type { Env } from './config.js';
import type { JwtPayload } from './types.js';

/**
 * Hono Variables available on all route contexts.
 *
 * Set by middleware:
 * - requestId: set by request-id middleware
 * - user: set by authenticate middleware
 */
export interface AppVariables {
  requestId: string;
  user: JwtPayload;
}

/**
 * Standard Hono app type used across all routes and middleware.
 * Bindings = Env (Cloudflare Worker env vars)
 * Variables = AppVariables (middleware-injected context values)
 */
export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
