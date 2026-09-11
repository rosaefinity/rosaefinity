// =============================================
// RosaeFinity Worker — Password Hashing
// Supports both scrypt (new) and bcryptjs (legacy) for compatibility
// Uses @noble/hashes scrypt for new passwords (Workers-compatible)
// Uses bcryptjs for legacy bcrypt hash verification (pure JS, Workers-compatible)
// =============================================

import { scryptAsync } from '@noble/hashes/scrypt';
import { randomBytes } from '@noble/hashes/utils';
import bcryptjs from 'bcryptjs';

const SALT_LENGTH = 16;
const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, dkLen: 64 };
const BCRYPT_ROUNDS = 12;

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
 * Detect if a stored hash is bcrypt format.
 * bcrypt hashes start with $2a$, $2b$, or $2y$ followed by cost parameter.
 */
function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

/**
 * Detect if a stored hash is scrypt format (salt:hash).
 */
function isScryptHash(hash: string): boolean {
  return /^[0-9a-f]+:[0-9a-f]+$/.test(hash);
}

/**
 * Hash a password using scrypt (new format).
 * Returns a string in format: salt_hex:hash_hex
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(
    new TextEncoder().encode(password),
    salt,
    SCRYPT_PARAMS,
  );
  return `${bufToHex(salt)}:${bufToHex(hash)}`;
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt (legacy) and scrypt (new) formats.
 * If bcrypt hash is verified, returns { verified: true, needsMigration: true }
 * to trigger re-hashing with scrypt.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<{ verified: boolean; needsMigration: boolean }> {
  // Try bcrypt first (legacy format)
  if (isBcryptHash(storedHash)) {
    const valid = bcryptjs.compareSync(password, storedHash);
    if (valid) {
      return { verified: true, needsMigration: true };
    }
    return { verified: false, needsMigration: false };
  }

  // Try scrypt (new format)
  if (isScryptHash(storedHash)) {
    const [saltHex, hashHex] = storedHash.split(':');
    if (!saltHex || !hashHex) return { verified: false, needsMigration: false };

    const salt = hexToBuf(saltHex);
    const expectedHash = hexToBuf(hashHex);

    const computedHash = await scryptAsync(
      new TextEncoder().encode(password),
      salt,
      SCRYPT_PARAMS,
    );

    const verified = timingSafeEqual(computedHash, expectedHash);
    return { verified, needsMigration: false };
  }

  // Unknown format
  return { verified: false, needsMigration: false };
}

/**
 * Re-hash a password from bcrypt to scrypt after successful verification.
 * Should be called after verifyPassword returns needsMigration: true.
 */
export async function rehashPassword(password: string): Promise<string> {
  return hashPassword(password);
}

/**
 * Hash a password using bcryptjs (for legacy hash creation if needed).
 * This is exported for testing/migration purposes only.
 * New passwords should use hashPassword() which uses scrypt.
 */
export async function hashPasswordBcrypt(password: string): Promise<string> {
  return bcryptjs.hash(password, BCRYPT_ROUNDS);
}

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}