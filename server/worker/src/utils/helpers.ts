// =============================================
// RosaeFinity Worker — Utility Helpers
// =============================================

import { generateId, sha256 } from '../crypto.js';

/** Generate a short ID (8 chars) */
export function generateShortId(): string {
  return generateId().replace(/-/g, '').substring(0, 8);
}

/** Generate a license key: ROSAE-XXXX-XXXX-XXXX */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments: string[] = [];
  for (let i = 0; i < 3; i++) {
    let seg = '';
    for (let j = 0; j < 4; j++) {
      seg += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(seg);
  }
  return `ROSAE-${segments.join('-')}`;
}

/** Mask a license key for display: ROSAE-ABCD-****-EFGH */
export function maskLicenseKey(key: string): string {
  if (!key || key.length < 19) return key;
  return `${key.substring(0, 9)}****${key.substring(14)}`;
}

/** Paginate an array */
export function paginate<T>(
  items: T[],
  page: number,
  limit: number,
): { data: T[]; total: number; page: number; limit: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);
  return { data, total, page, limit, totalPages };
}

/** Safe JSON parse */
export function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

/** Compute a simple checksum for sync validation */
export async function computeChecksum(data: unknown): Promise<string> {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = await sha256(str);
  return hash.substring(0, 16);
}
