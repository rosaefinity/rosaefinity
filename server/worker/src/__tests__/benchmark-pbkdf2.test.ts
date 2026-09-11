// =============================================
// RosaeFinity Worker — PBKDF2 Benchmark
// Measures Web Crypto PBKDF2 for Workers Free viability
// =============================================

import { describe, it } from 'vitest';

async function pbkdf2Hash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const hashArray = new Uint8Array(hash);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:600000:sha256:${saltHex}:${hashHex}`;
}

async function pbkdf2Verify(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  const iterations = parseInt(parts[1]);
  const saltHex = parts[3];
  const expectedHex = parts[4];

  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const computedHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHex === expectedHex;
}

describe('PBKDF2 Benchmark (Workers Free candidate)', () => {
  it('PBKDF2-SHA256 600K iterations — hash', async () => {
    const password = 'benchmark-pbkdf2-test';
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await pbkdf2Hash(password);
      times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    console.log(`[PBKDF2-BENCH] hash (600K): avg=${avg.toFixed(1)}ms, max=${max.toFixed(1)}ms`);
    console.log(`[PBKDF2-BENCH] Within 10ms limit: ${max < 10 ? 'YES' : 'NO'}`);
  });

  it('PBKDF2-SHA256 600K iterations — verify', async () => {
    const hash = await pbkdf2Hash('test-password');
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await pbkdf2Verify('test-password', hash);
      times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    console.log(`[PBKDF2-BENCH] verify (600K): avg=${avg.toFixed(1)}ms, max=${max.toFixed(1)}ms`);
    console.log(`[PBKDF2-BENCH] Within 10ms limit: ${max < 10 ? 'YES' : 'NO'}`);
  });

  it('PBKDF2-SHA256 100K iterations — hash', async () => {
    const password = 'benchmark-pbkdf2-test';
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const keyMaterial = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
      );
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256,
      );
      times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    console.log(`[PBKDF2-BENCH] hash (100K): avg=${avg.toFixed(1)}ms, max=${max.toFixed(1)}ms`);
    console.log(`[PBKDF2-BENCH] Within 10ms limit: ${max < 10 ? 'YES' : 'NO'}`);
  });

  it('Web Crypto SHA-256 hash (no KDF) — baseline', async () => {
    const iterations = 10;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode('test-data'));
      times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`[PBKDF2-BENCH] SHA-256 only: avg=${avg.toFixed(3)}ms`);
  });
});
