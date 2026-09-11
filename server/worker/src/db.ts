// =============================================
// RosaeFinity Worker — Prisma Client (Edge)
// Uses Neon serverless driver for Cloudflare Workers
// =============================================

import { PrismaClient } from '@prisma/client';
import { PrismaNeonHTTP } from '@prisma/adapter-neon';
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

export function getPrisma(env: Env) {
  if (!_prisma) {
    _prisma = createPrismaClient(env);
  }
  return _prisma;
}

export type PrismaClientType = ReturnType<typeof getPrisma>;
