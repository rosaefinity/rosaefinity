// =============================================
// RosaeFinity — Admin Service
// =============================================

import { adminRepository } from './repository.js';
import { getPrisma } from '../../../database/client.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../middleware/error-handler.js';
import { generateLicenseKey } from '../../../utils/helpers.js';

const prisma = getPrisma();

/**
 * Find the canonical Pro license for a user.
 *
 * CRITICAL BUSINESS RULE:
 * - ONLY active/grace licenses with FUTURE expiresAt can be renewed
 * - Revoked/expired licenses ALWAYS reactivate from NOW, never from old expiresAt
 * - Historical expiresAt values on revoked licenses MUST NOT influence reactivation
 */
async function getCanonicalProLicense(userId: string) {
  const now = new Date();

  const allProLicenses = await prisma.license.findMany({
    where: { userId, planId: 'pro' },
    orderBy: { createdAt: 'desc' },
  });

  if (allProLicenses.length === 0) return null;

  // ONLY active/grace with FUTURE expiry can act as a renewal source
  const currentActiveEntitlement = allProLicenses.find(l =>
    (l.status === 'active' || l.status === 'grace') &&
    l.expiresAt !== null &&
    l.expiresAt.getTime() > now.getTime()
  );

  if (currentActiveEntitlement) {
    return currentActiveEntitlement;
  }

  // No current active entitlement - return most recent for reactivation
  // BUT: its old expiresAt MUST NOT be used as base time
  return allProLicenses[0];
}

export const adminService = {
  async getDashboard() {
    return adminRepository.getDashboardStats();
  },

  async getUsers(page = 1, limit = 20) {
    return adminRepository.getUsers(page, limit);
  },

  async getUser(id: string) {
    return adminRepository.getUserById(id);
  },

  async getAuditLogs(page = 1, limit = 50) {
    return adminRepository.getAuditLogs(page, limit);
  },

  async getHealth() {
    return adminRepository.getHealth();
  },

  /** Extend (or reactivate) a user's Pro license by N days.
   *
   * CRITICAL BUSINESS RULES:
   *
   * CASE A - REACTIVATION (revoked/expired/no active entitlement):
   *   baseTime = NOW (server time)
   *   NEVER use old/historical expiresAt
   *
   * CASE B - RENEWAL (active/grace with future expiry):
   *   baseTime = existing expiresAt
   *   Preserves normal renewal behavior
   */
  async extendLicense(userId: string, days: number) {
    const now = new Date();

    // Get all Pro licenses
    const allProLicenses = await prisma.license.findMany({
      where: { userId, planId: 'pro' },
      orderBy: { createdAt: 'desc' },
    });

    console.log('[EXTEND] User:', userId);
    console.log('[EXTEND] Current time:', now.toISOString());
    console.log('[EXTEND] Days to add:', days);
    console.log('[EXTEND] Pro licenses found:', allProLicenses.length);

    allProLicenses.forEach((lic, idx) => {
      console.log(`[EXTEND] License[${idx}]: id=${lic.id} status=${lic.status} expiresAt=${lic.expiresAt?.toISOString() ?? 'null'}`);
    });

    if (allProLicenses.length === 0) {
      throw new NotFoundError('No Pro license found for this user. Use Activate Pro first.');
    }

    // Determine if there is a CURRENT ACTIVE ENTITLEMENT
    // ONLY active/grace with FUTURE expiry qualifies
    const currentActiveEntitlement = allProLicenses.find(l =>
      (l.status === 'active' || l.status === 'grace') &&
      l.expiresAt !== null &&
      l.expiresAt.getTime() > now.getTime()
    );

    let license: typeof allProLicenses[0];
    let baseTime: Date;
    let isReactivation: boolean;

    if (currentActiveEntitlement) {
      // CASE B: RENEWAL - extend from existing expiry
      license = currentActiveEntitlement;
      baseTime = license.expiresAt!;
      isReactivation = false;

      console.log('[EXTEND] CASE B: RENEWAL from existing active entitlement');
      console.log('[EXTEND] License:', license.id);
      console.log('[EXTEND] Status:', license.status);
      console.log('[EXTEND] Current expiry:', license.expiresAt!.toISOString());
      console.log('[EXTEND] Base time: EXISTING EXPIRY');
    } else {
      // CASE A: REACTIVATION - start from NOW
      license = allProLicenses[0]; // Most recent Pro license
      baseTime = now;
      isReactivation = true;

      console.log('[EXTEND] CASE A: REACTIVATION (no active entitlement)');
      console.log('[EXTEND] License:', license.id);
      console.log('[EXTEND] Status:', license.status);
      console.log('[EXTEND] Old expiresAt:', license.expiresAt?.toISOString() ?? 'null');
      console.log('[EXTEND] Base time: NOW (IGNORING OLD EXPIRY)');
    }

    // Calculate new expiry
    const newExpiresAt = new Date(baseTime.getTime() + days * 24 * 60 * 60 * 1000);

    console.log('[EXTEND] Calculation:');
    console.log('[EXTEND]   baseTime:', baseTime.toISOString());
    console.log('[EXTEND]   days:', days);
    console.log('[EXTEND]   newExpiresAt:', newExpiresAt.toISOString());

    // SAFETY CHECK: For reactivation, verify baseTime is actually NOW
    if (isReactivation) {
      const timeDiffMs = Math.abs(baseTime.getTime() - now.getTime());
      if (timeDiffMs > 1000) {
        console.error('[EXTEND] SAFETY VIOLATION: Reactivation baseTime is not NOW!');
        console.error('[EXTEND]   baseTime:', baseTime.toISOString());
        console.error('[EXTEND]   now:', now.toISOString());
        console.error('[EXTEND]   diff (ms):', timeDiffMs);
        throw new Error('Internal error: Reactivation must use current time as base');
      }
    }

    // Update the license
    const updated = await prisma.license.update({
      where: { id: license.id },
      data: {
        status: 'active',
        expiresAt: newExpiresAt,
        lastValidatedAt: now,
      },
    });

    console.log('[EXTEND] Updated license:', updated.id);
    console.log('[EXTEND] New status:', updated.status);
    console.log('[EXTEND] New expiresAt:', updated.expiresAt?.toISOString());

    // Update user account type
    await prisma.user.update({
      where: { id: userId },
      data: { accountType: 'pro' },
    });

    return {
      success: true,
      status: 'active',
      newExpiresAt: newExpiresAt.toISOString(),
    };
  },

  /** Activate a license for a specific user (admin action).
   *  Generates a unique license key server-side. Never reuses another user's key. */
  async activateForUser(userId: string, planId: string, durationDays: number) {
    console.log('[ADMIN ACTIVATE] START', { userId, planId, durationDays });

    // 1. Validate user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    console.log('[ADMIN ACTIVATE] user:', user ? `${user.email} (${user.id})` : 'NOT FOUND');
    if (!user) throw new NotFoundError('User not found');

    // 2. Check if user already has an active non-free license
    const existingLicense = await prisma.license.findFirst({
      where: { userId, status: { in: ['active', 'grace'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    console.log('[ADMIN ACTIVATE] existing license:', existingLicense ? `${existingLicense.planId}/${existingLicense.status}` : 'none');
    if (existingLicense && existingLicense.planId !== 'free') {
      throw new ConflictError(`User already has an active ${existingLicense.planId} license. Deactivate it first.`);
    }

    // 3. Validate plan exists
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    console.log('[ADMIN ACTIVATE] plan:', plan ? `${plan.id} (${plan.name})` : 'NOT FOUND');
    if (!plan) throw new NotFoundError(`Plan '${planId}' not found in database`);

    // 4. Generate a unique license key
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    let licenseKey: string | null = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateLicenseKey();
      const existing = await prisma.license.findUnique({ where: { licenseKey: candidate } });
      if (!existing) {
        licenseKey = candidate;
        break;
      }
      console.log('[ADMIN ACTIVATE] key collision, retrying...', attempt + 1);
    }

    if (!licenseKey) {
      console.error('[ADMIN ACTIVATE] FAILED: could not generate unique key after 10 attempts');
      throw new Error('Failed to generate a unique license key. Please try again.');
    }
    console.log('[ADMIN ACTIVATE] generated key:', licenseKey);

    // 5. Create the license
    try {
      const license = await prisma.license.create({
        data: {
          userId,
          planId,
          licenseKey,
          email: user.email ?? undefined,
          expiresAt,
        },
        include: { plan: true },
      });

      // 6. Update user account type
      await prisma.user.update({ where: { id: userId }, data: { accountType: planId } });

      console.log('[ADMIN ACTIVATE] SUCCESS', { licenseId: license.id, plan: planId, expiresAt: expiresAt.toISOString() });
      return {
        id: license.id,
        user_id: userId,
        plan: planId,
        status: license.status,
        license_key: licenseKey,
        expires_at: expiresAt.toISOString(),
      };
    } catch (error: unknown) {
      const prismaError = error as { code?: string; meta?: Record<string, unknown> };
      console.error('[ADMIN ACTIVATE] DB ERROR', {
        code: prismaError.code,
        meta: prismaError.meta,
        message: error instanceof Error ? error.message : String(error),
      });
      if (prismaError.code === 'P2002') {
        throw new ConflictError('License creation conflict. Please try again.');
      }
      if (prismaError.code === 'P2003') {
        throw new BadRequestError('Invalid user or plan reference. Database foreign key constraint failed.');
      }
      throw error;
    }
  },

  /** Downgrade a user from Pro to Free (Deactivate)
   *
   * CRITICAL: Revokes ALL active/grace Pro licenses and clears their expiresAt
   * This ensures no historical expiresAt can be used for future reactivation
   */
  async downgradeUser(userId: string) {
    console.log('[DEACTIVATE] ========================================');
    console.log('[DEACTIVATE] User:', userId);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    // Log ALL Pro licenses BEFORE deactivation
    const allProBefore = await prisma.license.findMany({
      where: { userId, planId: 'pro' },
      orderBy: { createdAt: 'desc' },
    });
    console.log('[DEACTIVATE] Licenses BEFORE:');
    allProBefore.forEach((l, idx) => {
      console.log(`[DEACTIVATE]   [${idx}] id=${l.id} status=${l.status} expiresAt=${l.expiresAt?.toISOString() ?? 'null'}`);
    });

    // CRITICAL: Revoke ALL active/grace Pro licenses AND clear expiresAt
    // This is the key fix - we must clear expiresAt on revoked licenses
    // so they can never be used as a base for reactivation
    const revokeResult = await prisma.license.updateMany({
      where: {
        userId,
        planId: 'pro',
        status: { in: ['active', 'grace'] }
      },
      data: {
        status: 'revoked',
        expiresAt: null  // MUST be null to prevent historical date leakage
      },
    });

    console.log('[DEACTIVATE] Revoked:', revokeResult.count, 'active/grace Pro license(s)');

    // Cancel active Pro subscriptions
    await prisma.subscription.updateMany({
      where: { userId, planId: 'pro', status: 'active' },
      data: { status: 'cancelled', cancelAtPeriodEnd: true },
    });

    // Downgrade account type
    await prisma.user.update({
      where: { id: userId },
      data: { accountType: 'free' },
    });

    // Log ALL Pro licenses AFTER deactivation
    const allProAfter = await prisma.license.findMany({
      where: { userId, planId: 'pro' },
      orderBy: { createdAt: 'desc' },
    });
    console.log('[DEACTIVATE] Licenses AFTER:');
    allProAfter.forEach((l, idx) => {
      console.log(`[DEACTIVATE]   [${idx}] id=${l.id} status=${l.status} expiresAt=${l.expiresAt?.toISOString() ?? 'null'}`);
    });

    // Verify no active/grace Pro licenses remain
    const remainingActive = allProAfter.filter(l => l.status === 'active' || l.status === 'grace');
    if (remainingActive.length > 0) {
      console.error('[DEACTIVATE] ERROR: Active/grace Pro licenses still exist!', remainingActive.map(l => l.id));
    } else {
      console.log('[DEACTIVATE] VERIFIED: No active/grace Pro licenses remain ✓');
    }

    console.log('[DEACTIVATE] ========================================');

    return { success: true };
  },
};
