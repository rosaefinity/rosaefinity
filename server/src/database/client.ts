// =============================================
// RosaeFinity Server — Prisma Client Singleton
// =============================================

import { PrismaClient } from '@prisma/client';
import { getConfig } from '../config/index.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const config = getConfig();
  const client = new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  globalForPrisma.prisma = client;
  return client;
}
