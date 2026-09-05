// =============================================
// Admin License Extension Tests
// Tests for deactivate/reactivate date calculation
// =============================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { adminService } from '../service.js';
import { getPrisma } from '../../../../database/client.js';

const prisma = getPrisma();

describe('Admin License Extension - Date Calculation', () => {
  const TEST_USER_ID = 'test-user-license-extension';
  const TEST_EMAIL = 'test-license@example.com';

  beforeEach(async () => {
    // Clean up test data
    await prisma.license.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });

    // Create test user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        accountType: 'free',
      },
    });

    // Ensure 'pro' plan exists
    await prisma.plan.upsert({
      where: { id: 'pro' },
      create: {
        id: 'pro',
        name: 'Pro',
        maxActions: 999,
        maxSounds: 999,
        maxOverlays: 999,
        maxProfiles: 10,
        maxScreens: 5,
        maxPointsUsers: 999,
        maxDevices: 5,
      },
      update: {},
    });
  });

  afterEach(async () => {
    // Clean up
    await prisma.license.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  });

  it('CASE 1: Active Pro with future expiry - extends from existing expiry', async () => {
    const futureExpiry = new Date('2026-10-10T00:00:00Z');

    // Create active Pro license
    await prisma.license.create({
      data: {
        userId: TEST_USER_ID,
        planId: 'pro',
        status: 'active',
        expiresAt: futureExpiry,
      },
    });

    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { accountType: 'pro' },
    });

    // Extend by 30 days
    const result = await adminService.extendLicense(TEST_USER_ID, 30);

    expect(result.success).toBe(true);
    expect(result.status).toBe('active');

    const expected = new Date(futureExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
    const actual = new Date(result.newExpiresAt);

    // Allow 1 second tolerance for test execution time
    expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it('CASE 2: Deactivate sets status=revoked and expiresAt=null', async () => {
    const futureExpiry = new Date('2028-09-16T00:00:00Z');

    // Create active Pro license
    await prisma.license.create({
      data: {
        userId: TEST_USER_ID,
        planId: 'pro',
        status: 'active',
        expiresAt: futureExpiry,
      },
    });

    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { accountType: 'pro' },
    });

    // Deactivate
    const result = await adminService.downgradeUser(TEST_USER_ID);
    expect(result.success).toBe(true);

    // Verify user is downgraded
    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    expect(user?.accountType).toBe('free');

    // Verify all Pro licenses are revoked with null expiry
    const licenses = await prisma.license.findMany({
      where: { userId: TEST_USER_ID, planId: 'pro' },
    });

    expect(licenses.length).toBeGreaterThan(0);
    licenses.forEach(license => {
      expect(license.status).toBe('revoked');
      expect(license.expiresAt).toBeNull();
    });
  });

  it('CASE 3: Deactivate → +30 days starts from NOW, not old expiry', async () => {
    const oldExpiry = new Date('2028-09-16T00:00:00Z');

    // Create active Pro license with future expiry
    await prisma.license.create({
      data: {
        userId: TEST_USER_ID,
        planId: 'pro',
        status: 'active',
        expiresAt: oldExpiry,
      },
    });

    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { accountType: 'pro' },
    });

    // Deactivate
    await adminService.downgradeUser(TEST_USER_ID);

    // Reactivate with +30 days
    const now = new Date();
    const result = await adminService.extendLicense(TEST_USER_ID, 30);

    expect(result.success).toBe(true);
    expect(result.status).toBe('active');

    const expected = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const actual = new Date(result.newExpiresAt);

    // Should be ~30 days from NOW, NOT from 2028
    expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThan(2000);

    // Verify it's NOT based on the old 2028 expiry
    const oldExpiryPlus30 = new Date(oldExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(Math.abs(actual.getTime() - oldExpiryPlus30.getTime())).toBeGreaterThan(24 * 60 * 60 * 1000);
  });

  it('CASE 4: Multiple active/grace licenses - deactivate revokes ALL', async () => {
    const expiry1 = new Date('2028-05-19T00:00:00Z');
    const expiry2 = new Date('2028-09-16T00:00:00Z');

    // Create multiple active Pro licenses (edge case)
    await prisma.license.create({
      data: {
        userId: TEST_USER_ID,
        planId: 'pro',
        status: 'active',
        expiresAt: expiry1,
      },
    });

    await prisma.license.create({
      data: {
        userId: TEST_USER_ID,
        planId: 'pro',
        status: 'grace',
        expiresAt: expiry2,
      },
    });

    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { accountType: 'pro' },
    });

    // Deactivate
    await adminService.downgradeUser(TEST_USER_ID);

    // Verify ALL are revoked
    const licenses = await prisma.license.findMany({
      where: { userId: TEST_USER_ID, planId: 'pro' },
    });

    expect(licenses.length).toBe(2);
    licenses.forEach(license => {
      expect(license.status).toBe('revoked');
      expect(license.expiresAt).toBeNull();
    });
  });

  it('CASE 5: Reactivate after deactivate, then extend again uses current expiry', async () => {
    // Create and deactivate
    await prisma.license.create({
      data: {
        userId: TEST_USER_ID,
        planId: 'pro',
        status: 'active',
        expiresAt: new Date('2028-09-16T00:00:00Z'),
      },
    });

    await adminService.downgradeUser(TEST_USER_ID);

    // First reactivation: +30 days from now
    const firstReactivation = await adminService.extendLicense(TEST_USER_ID, 30);
    const firstExpiry = new Date(firstReactivation.newExpiresAt);

    // Second extension: should extend from first expiry, not from now
    const secondExtension = await adminService.extendLicense(TEST_USER_ID, 30);
    const secondExpiry = new Date(secondExtension.newExpiresAt);

    const expected = new Date(firstExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);

    expect(Math.abs(secondExpiry.getTime() - expected.getTime())).toBeLessThan(2000);
  });

  it('CASE 6: +90 days after deactivation starts from NOW', async () => {
    await prisma.license.create({
      data: {
        userId: TEST_USER_ID,
        planId: 'pro',
        status: 'active',
        expiresAt: new Date('2028-09-16T00:00:00Z'),
      },
    });

    await adminService.downgradeUser(TEST_USER_ID);

    const now = new Date();
    const result = await adminService.extendLicense(TEST_USER_ID, 90);

    const expected = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const actual = new Date(result.newExpiresAt);

    expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThan(2000);
  });

  it('CASE 7: +365 days after deactivation starts from NOW', async () => {
    await prisma.license.create({
      data: {
        userId: TEST_USER_ID,
        planId: 'pro',
        status: 'active',
        expiresAt: new Date('2028-09-16T00:00:00Z'),
      },
    });

    await adminService.downgradeUser(TEST_USER_ID);

    const now = new Date();
    const result = await adminService.extendLicense(TEST_USER_ID, 365);

    const expected = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const actual = new Date(result.newExpiresAt);

    expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThan(2000);
  });

  it('CASE 8: Revoked license with old 2028 expiry must start from NOW', async () => {
    const oldExpiry = new Date('2028-09-16T00:00:00Z');

    // Simulate a license that was revoked but still has the old expiry (bug scenario)
    await prisma.license.create({
      data: {
        userId: TEST_USER_ID,
        planId: 'pro',
        status: 'revoked',
        expiresAt: oldExpiry, // This should be null, but testing robustness
      },
    });

    const now = new Date();
    const result = await adminService.extendLicense(TEST_USER_ID, 30);

    const expected = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const actual = new Date(result.newExpiresAt);

    // Should start from NOW, not from the old 2028 date
    expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThan(2000);
  });

  it('CASE 9: Expired license (past expiry, active status) starts from NOW', async () => {
    const pastExpiry = new Date('2026-01-01T00:00:00Z');

    // Create "active" license with past expiry (effectively expired)
    await prisma.license.create({
      data: {
        userId: TEST_USER_ID,
        planId: 'pro',
        status: 'active',
        expiresAt: pastExpiry,
      },
    });

    const now = new Date();
    const result = await adminService.extendLicense(TEST_USER_ID, 30);

    const expected = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const actual = new Date(result.newExpiresAt);

    // Should start from NOW since the expiry is in the past
    expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThan(2000);
  });
});
