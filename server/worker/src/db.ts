// =============================================
// RosaeFinity Worker — Prisma Client (Edge)
// Uses Neon serverless driver for Cloudflare Workers
// =============================================

import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP, PrismaNeon } from '@prisma/adapter-neon';
import type { Env } from './config.js';

let _prisma: ReturnType<typeof createPrismaClient> | null = null;

function createPrismaClient(env: Env) {
  const adapter = new PrismaNeonHTTP(env.DATABASE_URL, {
    arrayMode: false,
    fullResults: false,
  });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

/**
 * Create a per-request PrismaClient backed by a WebSocket connection pool.
 * Use this ONLY for interactive $transaction() calls that require a
 * persistent connection across multiple queries.
 *
 * The returned client MUST be disposed via client.$disconnect() after use.
 * WebSocket connections cannot outlive a single request in Workers.
 */
export function createTransactionalClient(env: Env): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export function getPrisma(env: Env) {
  if (!_prisma) {
    _prisma = createPrismaClient(env);
  }
  return _prisma;
}

export type PrismaClientType = ReturnType<typeof getPrisma>;
