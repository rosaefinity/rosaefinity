// =============================================
// RosaeFinity Worker — License Tests
// =============================================

import { describe, it, expect } from 'vitest';
import { generateLicenseKey, maskLicenseKey } from '../utils/helpers.js';

describe('License Helpers', () => {
  it('generates valid license key format', () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^ROSAE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('generates unique keys', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(generateLicenseKey());
    }
    // Very low collision probability with 36^12 possibilities
    expect(keys.size).toBeGreaterThan(95);
  });

  it('masks license key correctly', () => {
    const key = 'ROSAE-ABCD-EFGH-IJKL';
    const masked = maskLicenseKey(key);
    expect(masked).toBe('ROSAE-ABC****H-IJKL');
  });

  it('handles short keys gracefully', () => {
    const short = 'SHORT';
    const masked = maskLicenseKey(short);
    expect(masked).toBe(short);
  });
});
