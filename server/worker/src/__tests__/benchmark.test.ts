// =============================================
// RosaeFinity Worker — Password Hash Benchmark
// Measures actual CPU time for scrypt operations
// =============================================

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password.js';

function getVerified(result: { verified: boolean; needsMigration: boolean }): boolean {
  return result.verified;
}

describe('Password Hashing Benchmark', () => {
  it('measures hash generation time', async () => {
    const password = 'benchmark-test-password-123';
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await hashPassword(password);
      const elapsed = performance.now() - start;
      times.push(elapsed);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    console.log(`[BENCHMARK] hashPassword: avg=${avg.toFixed(1)}ms, min=${min.toFixed(1)}ms, max=${max.toFixed(1)}ms (n=${iterations})`);
    console.log(`[BENCHMARK] Cloudflare Free limit: 10ms CPU/request`);
    console.log(`[BENCHMARK] Result: ${max < 10 ? 'WITHIN LIMIT' : 'EXCEEDS LIMIT — needs parameter tuning'}`);

    // Record result for report
    console.log(JSON.stringify({ operation: 'hashPassword', avg, min, max, iterations, limit: 10, withinLimit: max < 10 }));

    expect(avg).toBeGreaterThan(0);
  });

  it('measures password verification time', async () => {
    const password = 'benchmark-test-password-123';
    const hash = await hashPassword(password);
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = await verifyPassword(password, hash);
      const elapsed = performance.now() - start;
      times.push(elapsed);
      // Just to use the result
      void result;
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);

    console.log(`[BENCHMARK] verifyPassword: avg=${avg.toFixed(1)}ms, min=${min.toFixed(1)}ms, max=${max.toFixed(1)}ms (n=${iterations})`);
    console.log(`[BENCHMARK] Cloudflare Free limit: 10ms CPU/request`);
    console.log(`[BENCHMARK] Result: ${max < 10 ? 'WITHIN LIMIT' : 'EXCEEDS LIMIT — needs parameter tuning'}`);

    console.log(JSON.stringify({ operation: 'verifyPassword', avg, min, max, iterations, limit: 10, withinLimit: max < 10 }));

    expect(avg).toBeGreaterThan(0);
  });

  it('measures wrong password verification time', async () => {
    const hash = await hashPassword('correct-password');
    const iterations = 3;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await verifyPassword('wrong-password', hash);
      const elapsed = performance.now() - start;
      times.push(elapsed);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);

    console.log(`[BENCHMARK] verifyPassword(wrong): avg=${avg.toFixed(1)}ms, max=${max.toFixed(1)}ms`);
    console.log(JSON.stringify({ operation: 'verifyPassword_wrong', avg, max, limit: 10, withinLimit: max < 10 }));

    expect(avg).toBeGreaterThan(0);
  });

  it('measures login simulation (hash + verify cycle)', async () => {
    const password = 'simulation-password-456';

    // Simulate registration: hash
    const hashStart = performance.now();
    const hash = await hashPassword(password);
    const hashTime = performance.now() - hashStart;

    // Simulate login: verify
    const verifyStart = performance.now();
    const result = await verifyPassword(password, hash);
    const verifyTime = performance.now() - verifyStart;

    const totalTime = hashTime + verifyTime;
    const valid = getVerified(result);

    console.log(`[BENCHMARK] Login simulation: hash=${hashTime.toFixed(1)}ms + verify=${verifyTime.toFixed(1)}ms = total=${totalTime.toFixed(1)}ms`);
    console.log(`[BENCHMARK] Cloudflare Free limit: 10ms CPU/request`);
    console.log(`[BENCHMARK] Registration (hash only): ${hashTime < 10 ? 'OK' : 'EXCEEDS'}`);
    console.log(`[BENCHMARK] Login (verify only): ${verifyTime < 10 ? 'OK' : 'EXCEEDS'}`);

    console.log(JSON.stringify({
      operation: 'login_simulation',
      hashTime, verifyTime, totalTime,
      limit: 10,
      hashWithinLimit: hashTime < 10,
      verifyWithinLimit: verifyTime < 10,
    }));

    expect(valid).toBe(true);
  });
});
