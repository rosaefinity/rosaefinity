// =============================================
// RosaeFinity — Password Hashing Utility
// Supports both scrypt (new) and bcrypt (legacy) for
// Node ↔ Worker compatibility during migration.
// =============================================

import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const SALT_LENGTH = 16;
const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, dkLen: 64 };

/**
 * Detect if a stored hash is bcrypt format ($2a$, $2b$, or $2y$).
 */
function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

/**
 * Detect if a stored hash is scrypt format (salt_hex:hash_hex).
 */
function isScryptHash(hash: string): boolean {
  return /^[0-9a-f]+:[0-9a-f]+$/.test(hash);
}

/**
 * Constant-time byte array comparison.
 * Prevents timing attacks on hash verification.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

/**
 * Convert a Uint8Array to a lowercase hex string.
 */
function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert a hex string to a Uint8Array.
 */
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Hash a password using scrypt (new format).
 * Returns a string in format: salt_hex:hash_hex
 * Matches the Worker's exact scrypt format and parameters.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derivedKey = crypto.scryptSync(
    password,
    salt,
    SCRYPT_PARAMS.dkLen,
    { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, maxmem: 128 * 1024 * 1024 },
  );
  return `${bufToHex(salt)}:${bufToHex(derivedKey)}`;
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt (legacy) and scrypt (new) formats.
 * If a bcrypt hash is successfully verified, returns needsMigration: true
 * to trigger re-hashing with scrypt (matching Worker behavior).
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ verified: boolean; needsMigration: boolean }> {
  // Try bcrypt first (legacy format)
  if (isBcryptHash(storedHash)) {
    const valid = await bcrypt.compare(password, storedHash);
    if (valid) {
      return { verified: true, needsMigration: true };
    }
    return { verified: false, needsMigration: false };
  }

  // Try scrypt (new format — matches Worker's hex:hex format)
  if (isScryptHash(storedHash)) {
    const [saltHex, hashHex] = storedHash.split(':');
    if (!saltHex || !hashHex) {
      return { verified: false, needsMigration: false };
    }

    const salt = hexToBuf(saltHex);
    const expectedHash = hexToBuf(hashHex);

    const derivedKey = crypto.scryptSync(
      password,
      salt,
      SCRYPT_PARAMS.dkLen,
      { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p, maxmem: 128 * 1024 * 1024 },
    );

    const verified = timingSafeEqual(derivedKey, expectedHash);
    return { verified, needsMigration: false };
  }

  // Unknown format
  return { verified: false, needsMigration: false };
}
