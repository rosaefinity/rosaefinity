// =============================================
// RosaeFinity — Admin License Service Tests
// Tests for extendLicense and downgradeUser
// =============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    license: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    subscription: {
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../../../database/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('../../../../utils/helpers.js', () => ({
  generateLicenseKey: () => 'ROSAE-TEST-1234-5678',
}));

import { adminService } from '../service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helper: create a mock license ──
function makeLicense(overrides: Partial<{
  id: string;
  planId: string;
  status: string;
  expiresAt: Date | null;
}> = {}) {
  return {
    id: overrides.id ?? 'lic-1',
    userId: 'user-1',
    planId: overrides.planId ?? 'pro',
    licenseKey: 'ROSAE-XXXX-XXXX-XXXX',
    status: overrides.status ?? 'active',
    expiresAt: overrides.expiresAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: { id: 'pro', name: 'Pro' },
  };
}

describe('extendLicense', () => {
  const NOW = new Date('2026-09-03T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('CASE A: ACTIVE PRO with future expiry extends from existing expiry', async () => {
    const futureExpiry = new Date('2026-10-03T12:00:00Z');
    mockPrisma.license.findMany.mockResolvedValue([makeLicense({
      status: 'active',
      expiresAt: futureExpiry,
    })]);
    mockPrisma.license.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const result = await adminService.extendLicense('user-1', 30);

    expect(result.success).toBe(true);
    const newExpiry = new Date(result.newExpiresAt);
    // Should extend from Oct 3 + 30 days = Nov 2
    expect(newExpiry.toISOString()).toBe('2026-11-02T12:00:00.000Z');
  });

  it('CASE B: EXPIRED PRO extends from now', async () => {
    const pastExpiry = new Date('2026-08-01T12:00:00Z');
    mockPrisma.license.findMany.mockResolvedValue([makeLicense({
      status: 'active',
      expiresAt: pastExpiry,
    })]);
    mockPrisma.license.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const result = await adminService.extendLicense('user-1', 30);

    const newExpiry = new Date(result.newExpiresAt);
    // Should extend from Sep 3 (now) + 30 days = Oct 3
    expect(newExpiry.toISOString()).toBe('2026-10-03T12:00:00.000Z');
  });

  it('CASE C: FREE user (no license found) throws error', async () => {
    mockPrisma.license.findMany.mockResolvedValue([]);

    await expect(adminService.extendLicense('user-1', 30)).rejects.toThrow('No Pro license found');
  });

  it('CASE D: REVOKED PRO with future expiry extends from now, not from old expiry', async () => {
    // This is the critical bug case: revoked license still has future expiresAt
    const futureExpiry = new Date('2028-01-20T12:00:00Z');
    mockPrisma.license.findMany.mockResolvedValue([makeLicense({
      status: 'revoked',
      expiresAt: futureExpiry,
    })]);
    mockPrisma.license.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const result = await adminService.extendLicense('user-1', 30);

    const newExpiry = new Date(result.newExpiresAt);
    // CRITICAL: Must extend from Sep 3 (now) + 30 days = Oct 3, NOT from Jan 2028
    expect(newExpiry.toISOString()).toBe('2026-10-03T12:00:00.000Z');
  });

  it('CASE D2: REVOKED PRO with null expiresAt extends from now', async () => {
    mockPrisma.license.findMany.mockResolvedValue([makeLicense({
      status: 'revoked',
      expiresAt: null,
    })]);
    mockPrisma.license.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const result = await adminService.extendLicense('user-1', 30);

    const newExpiry = new Date(result.newExpiresAt);
    expect(newExpiry.toISOString()).toBe('2026-10-03T12:00:00.000Z');
  });

  it('CASE: +90 Days from free extends from now', async () => {
    mockPrisma.license.findMany.mockResolvedValue([makeLicense({
      status: 'revoked',
      expiresAt: null,
    })]);
    mockPrisma.license.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const result = await adminService.extendLicense('user-1', 90);

    const newExpiry = new Date(result.newExpiresAt);
    // Sep 3 + 90 days = Dec 2
    expect(newExpiry.toISOString()).toBe('2026-12-02T12:00:00.000Z');
  });

  it('CASE: +365 Days from free extends from now', async () => {
    mockPrisma.license.findMany.mockResolvedValue([makeLicense({
      status: 'revoked',
      expiresAt: null,
    })]);
    mockPrisma.license.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const result = await adminService.extendLicense('user-1', 365);

    const newExpiry = new Date(result.newExpiresAt);
    // Sep 3 + 365 days = Sep 3, 2027
    expect(newExpiry.toISOString()).toBe('2027-09-03T12:00:00.000Z');
  });

  it('CASE: DEACTIVATE then REACTIVATE — old expiry does not influence new activation', async () => {
    // First: deactivate (clears expiresAt)
    const activeLicense = makeLicense({
      status: 'active',
      expiresAt: new Date('2028-01-20T12:00:00Z'),
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.license.update.mockResolvedValue({});
    mockPrisma.subscription.updateMany.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    await adminService.downgradeUser('user-1');

    // Verify expiresAt was cleared via update (canonical license targeted)
    expect(mockPrisma.license.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'revoked', expiresAt: null }),
      })
    );

    // Now extend the revoked license
    const revokedLicense = makeLicense({
      status: 'revoked',
      expiresAt: null, // cleared by downgrade
    });
    mockPrisma.license.findMany.mockResolvedValue([revokedLicense]);
    mockPrisma.license.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    vi.setSystemTime(new Date('2026-09-03T12:00:00Z'));
    const result = await adminService.extendLicense('user-1', 30);

    const newExpiry = new Date(result.newExpiresAt);
    // Must be Oct 3, 2026 — NOT Feb 19, 2028
    expect(newExpiry.toISOString()).toBe('2026-10-03T12:00:00.000Z');
  });
});

describe('downgradeUser', () => {
  it('sets expiresAt to null when deactivating', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.license.updateMany.mockResolvedValue({});
    mockPrisma.license.findFirst.mockResolvedValue(makeLicense({ status: 'revoked', expiresAt: null }));
    mockPrisma.subscription.updateMany.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const result = await adminService.downgradeUser('user-1');

    expect(result.success).toBe(true);
    // Verify expiresAt is cleared via updateMany with status in ['active', 'grace']
    expect(mockPrisma.license.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ planId: 'pro', status: { in: ['active', 'grace'] } }),
        data: expect.objectContaining({ status: 'revoked', expiresAt: null }),
      })
    );
  });

  it('clears grace-status licenses too', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.license.updateMany.mockResolvedValue({});
    mockPrisma.license.findFirst.mockResolvedValue(makeLicense({ status: 'revoked', expiresAt: null }));
    mockPrisma.subscription.updateMany.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const result = await adminService.downgradeUser('user-1');

    expect(result.success).toBe(true);
    // Verify it matches both 'active' AND 'grace' statuses
    expect(mockPrisma.license.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', planId: 'pro', status: { in: ['active', 'grace'] } },
      })
    );
  });
});
