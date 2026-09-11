// =============================================
// RosaeFinity Worker — Auth Tests
// =============================================

import { describe, it, expect } from 'vitest';
import { generateTokens, verifyAccessToken, verifyRefreshToken } from '../jwt.js';
import { hashPassword, verifyPassword, rehashPassword, hashPasswordBcrypt } from '../password.js';
import { TEST_ENV } from './setup.js';

const SECRET = TEST_ENV.JWT_SECRET;

describe('JWT Operations', () => {
  it('generates and verifies access token', async () => {
    const payload = { sub: 'user-1', email: 'test@test.com', planTier: 'free', role: 'USER' };
    const tokens = await generateTokens(payload, SECRET, '15m', '7d');

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');

    const verified = await verifyAccessToken(tokens.accessToken, SECRET);
    expect(verified.sub).toBe('user-1');
    expect(verified.email).toBe('test@test.com');
    expect(verified.planTier).toBe('free');
    expect(verified.role).toBe('USER');
  });

  it('generates and verifies refresh token', async () => {
    const payload = { sub: 'user-1', email: 'test@test.com', planTier: 'free', role: 'USER' };
    const tokens = await generateTokens(payload, SECRET, '15m', '7d');

    const verified = await verifyRefreshToken(tokens.refreshToken, SECRET);
    expect(verified.sub).toBe('user-1');
    expect(verified.type).toBe('refresh');
  });

  it('rejects invalid token', async () => {
    await expect(verifyAccessToken('invalid-token', SECRET)).rejects.toThrow();
  });

  it('rejects access token as refresh token', async () => {
    const payload = { sub: 'user-1', email: 'test@test.com', planTier: 'free', role: 'USER' };
    const tokens = await generateTokens(payload, SECRET, '15m', '7d');

    await expect(verifyRefreshToken(tokens.accessToken, SECRET)).rejects.toThrow();
  });
});

describe('Password Hashing', () => {
  it('hashes and verifies password (scrypt)', async () => {
    const password = 'testpass123';
    const hash = await hashPassword(password);

    expect(hash).toContain(':');
    expect(hash.split(':').length).toBe(2);

    const result = await verifyPassword(password, hash);
    expect(result.verified).toBe(true);
    expect(result.needsMigration).toBe(false);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('wrong-password', hash);
    expect(result.verified).toBe(false);
  });

  it('produces different hashes for same password', async () => {
    const hash1 = await hashPassword('testpass');
    const hash2 = await hashPassword('testpass');
    expect(hash1).not.toBe(hash2);
  });

  it('verifies bcrypt hash (legacy compatibility)', async () => {
    const password = 'testpass123';
    const bcryptHash = await hashPasswordBcrypt(password);

    expect(bcryptHash).toMatch(/^\$2[aby]\$\d{2}\$/);

    const result = await verifyPassword(password, bcryptHash);
    expect(result.verified).toBe(true);
    expect(result.needsMigration).toBe(true);
  });

  it('rejects wrong password for bcrypt hash', async () => {
    const bcryptHash = await hashPasswordBcrypt('correct-password');
    const result = await verifyPassword('wrong-password', bcryptHash);
    expect(result.verified).toBe(false);
    expect(result.needsMigration).toBe(false);
  });

  it('rehashes password after bcrypt verification', async () => {
    const password = 'testpass123';
    const bcryptHash = await hashPasswordBcrypt(password);

    const result = await verifyPassword(password, bcryptHash);
    expect(result.needsMigration).toBe(true);

    if (result.needsMigration) {
      const newHash = await rehashPassword(password);
      expect(newHash).not.toBe(bcryptHash);
      expect(newHash).toContain(':');

      const verifyResult = await verifyPassword(password, newHash);
      expect(verifyResult.verified).toBe(true);
      expect(verifyResult.needsMigration).toBe(false);
    }
  });
});
