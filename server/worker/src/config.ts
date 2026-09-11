// =============================================
// RosaeFinity Worker — Configuration
// Environment bindings from wrangler.toml / .dev.vars
// =============================================

export interface Env {
  // Required
  DATABASE_URL: string;
  JWT_SECRET: string;

  // Optional with defaults
  NODE_ENV?: string;
  JWT_EXPIRES_IN?: string;
  JWT_REFRESH_EXPIRES_IN?: string;
  CORS_ORIGINS?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX?: string;

  // Optional
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;

  // Update server
  UPDATE_GITHUB_OWNER?: string;
  UPDATE_GITHUB_REPO?: string;
}

export interface HealthConfig {
  NODE_ENV: string;
}

export function getHealthConfig(env: Env): HealthConfig {
  return {
    NODE_ENV: env.NODE_ENV || 'production',
  };
}

export function getConfig(env: Env): Required<
  Pick<Env, 'DATABASE_URL' | 'JWT_SECRET' | 'JWT_EXPIRES_IN' | 'JWT_REFRESH_EXPIRES_IN' | 'CORS_ORIGINS' | 'RATE_LIMIT_WINDOW_MS' | 'RATE_LIMIT_MAX' | 'NODE_ENV'>
> & Pick<Env, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY' | 'SUPABASE_SERVICE_ROLE_KEY' | 'UPDATE_GITHUB_OWNER' | 'UPDATE_GITHUB_REPO'> {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET is required and must be at least 32 characters');
  }

  return {
    DATABASE_URL: env.DATABASE_URL,
    JWT_SECRET: env.JWT_SECRET,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN || '15m',
    JWT_REFRESH_EXPIRES_IN: env.JWT_REFRESH_EXPIRES_IN || '7d',
    CORS_ORIGINS: env.CORS_ORIGINS || 'http://localhost:5173',
    RATE_LIMIT_WINDOW_MS: env.RATE_LIMIT_WINDOW_MS || '900000',
    RATE_LIMIT_MAX: env.RATE_LIMIT_MAX || '100',
    NODE_ENV: env.NODE_ENV || 'production',
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    UPDATE_GITHUB_OWNER: env.UPDATE_GITHUB_OWNER || 'RosaeFinity',
    UPDATE_GITHUB_REPO: env.UPDATE_GITHUB_REPO || 'RosaeFinity',
  };
}
