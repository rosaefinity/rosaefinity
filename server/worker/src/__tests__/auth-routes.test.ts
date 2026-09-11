// =============================================
// RosaeFinity Worker — Auth Route Tests
// (Integration tests requiring database)
// =============================================

import { describe, it, expect } from 'vitest';
import app from '../index.js';
import { TEST_ENV } from './setup.js';

// These tests require a running Neon database
// Skip in CI if DATABASE_URL is not set
const hasDb = TEST_ENV.DATABASE_URL && !TEST_ENV.DATABASE_URL.includes('localhost');

describe.skipIf(!hasDb)('Auth Routes (integration)', () => {
  it('POST /api/v1/auth/register creates user', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-${Date.now()}@test.com`,
        password: 'testpass123',
        displayName: 'Test User',
      }),
    }, TEST_ENV);

    const json: Record<string, unknown> = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    const data = json.data as Record<string, unknown>;
    expect(data.user).toBeDefined();
    expect(data.accessToken).toBeDefined();
    expect(data.refreshToken).toBeDefined();
  });

  it('POST /api/v1/auth/login returns tokens', async () => {
    // Register first
    const email = `login-test-${Date.now()}@test.com`;
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'testpass123' }),
    }, TEST_ENV);

    // Login
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'testpass123' }),
    }, TEST_ENV);

    const json: Record<string, unknown> = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    const data = json.data as Record<string, unknown>;
    expect(data.accessToken).toBeDefined();
  });

  it('POST /api/v1/auth/login/guest returns guest tokens', async () => {
    const res = await app.request('/api/v1/auth/login/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, TEST_ENV);

    const json: Record<string, unknown> = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    const data = json.data as Record<string, unknown>;
    const user = data.user as Record<string, unknown>;
    expect(user.isAnonymous).toBe(true);
  });

  it('GET /api/v1/auth/me requires auth', async () => {
    const res = await app.request('/api/v1/auth/me', {}, TEST_ENV);
    const json: Record<string, unknown> = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/auth/me returns user with valid token', async () => {
    // Register
    const email = `me-test-${Date.now()}@test.com`;
    const regRes = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'testpass123' }),
    }, TEST_ENV);
    const regJson: Record<string, unknown> = await regRes.json();
    const regData = regJson.data as Record<string, unknown>;

    // Get me
    const res = await app.request('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${regData.accessToken}` },
    }, TEST_ENV);
    const json: Record<string, unknown> = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    const data = json.data as Record<string, unknown>;
    expect(data.email).toBe(email);
  });
});

describe('Auth Routes (unit)', () => {
  it('POST /api/v1/auth/register rejects invalid email', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'testpass123' }),
    }, TEST_ENV);

    const json: Record<string, unknown> = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('POST /api/v1/auth/register rejects short password', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'short' }),
    }, TEST_ENV);

    const json: Record<string, unknown> = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });
});
