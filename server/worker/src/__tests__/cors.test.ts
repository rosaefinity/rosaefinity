// =============================================
// RosaeFinity Worker — CORS Tests
// =============================================

import { describe, it, expect } from 'vitest';
import app from '../index.js';
import { TEST_ENV } from './setup.js';

describe('CORS', () => {
  it('allows requests from configured origins', async () => {
    const res = await app.request('/health', {
      headers: { Origin: 'http://localhost:5173' },
    }, TEST_ENV);

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('handles OPTIONS preflight', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization',
      },
    }, TEST_ENV);

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('returns security headers', async () => {
    const res = await app.request('/health', {}, TEST_ENV);

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
  });
});
