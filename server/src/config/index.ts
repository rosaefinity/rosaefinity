// =============================================
// RosaeFinity Server — Configuration
// Environment validation with Zod.
// =============================================

import { z } from 'zod';

/**
 * Minimal config for health checks — never throws, never exits.
 * Uses safe defaults so /health is always reachable on Railway.
 */
export interface HealthConfig {
  NODE_ENV: string;
  PORT: number;
  HOST: string;
}

export function getHealthConfig(): HealthConfig {
  return {
    NODE_ENV: process.env.NODE_ENV || 'production',
    PORT: parseInt(process.env.PORT || '3000', 10),
    HOST: process.env.HOST || '0.0.0.0',
  };
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // Database — non-empty string (Railway Postgres URLs may not be standard http URLs)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Supabase
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // CORS (required in production)
  CORS_ORIGINS: process.env.NODE_ENV === 'production'
    ? z.string().min(1)
    : z.string().default('http://localhost:5173'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Update Server
  UPDATE_GITHUB_OWNER: z.string().default('RosaeFinity'),
  UPDATE_GITHUB_REPO: z.string().default('RosaeFinity'),
});

export type Env = z.infer<typeof envSchema>;

let _config: Env | null = null;

export function getConfig(): Env {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    console.error('❌ Invalid environment variables:');
    console.error(errors);
    // Throw instead of process.exit(1) so the server stays alive for /health.
    // The caller (setupApp) catches this and logs instructions.
    throw new Error(
      `Missing required environment variables: ${Object.keys(errors).join(', ')}`
    );
  }

  _config = result.data;
  return _config;
}
