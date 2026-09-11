// =============================================
// RosaeFinity Worker — Test Setup
// Mock environment for Vitest
// =============================================

export const TEST_ENV = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
  JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long!!',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  CORS_ORIGINS: 'http://localhost:5173,http://localhost:5174',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX: '100',
  NODE_ENV: 'test',
};
