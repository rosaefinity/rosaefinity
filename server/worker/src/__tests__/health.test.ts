// =============================================
// RosaeFinity Worker — Health Endpoint Tests
// =============================================

import { describe, it, expect } from 'vitest';
import app from '../index.js';
import { TEST_ENV } from './setup.js';

describe('Health Endpoints', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('/health', {}, TEST_ENV);
    const json: Record<string, unknown> = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe('ok');
    expect(json.version).toBe('1.0.0');
    expect(json.runtime).toBe('cloudflare-workers');
    expect(json.timestamp).toBeDefined();
  });

  it('GET /health/deployment returns deployment info', async () => {
    const res = await app.request('/health/deployment', {}, TEST_ENV);
    const json: Record<string, unknown> = await res.json();

    expect(res.status).toBe(200);
    expect(json.adminActivationRoute).toBe(true);
    expect(json.schemaVersion).toBe('plan+durationDays');
    expect(json.runtime).toBe('cloudflare-workers');
  });

  it('GET /health/admin-routes returns route list', async () => {
    const res = await app.request('/health/admin-routes', {}, TEST_ENV);
    const json: Record<string, unknown> = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.routes).toBeInstanceOf(Array);
    expect((json.routes as unknown[]).length).toBeGreaterThan(0);
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await app.request('/nonexistent', {}, TEST_ENV);
    const json: Record<string, unknown> = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.code).toBe('NOT_FOUND');
  });
});
