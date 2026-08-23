// =============================================
// RosaeFinity — Admin Service
// =============================================

import { adminRepository } from './repository.js';
import { getPrisma } from '../../../database/client.js';
import { NotFoundError, BadRequestError, ConflictError } from '../../middleware/error-handler.js';
import { generateLicenseKey } from '../../../utils/helpers.js';

const prisma = getPrisma();

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

  /** Extend a user's Pro license by N days */
  async extendLicense(userId: string, days: number) {
    const license = await prisma.license.findFirst({
      where: { userId, status: 'active', planId: 'pro' },
      orderBy: { createdAt: 'desc' },
    });
    if (!license) throw new NotFoundError('No active Pro license found for this user');

    const currentExpiry = license.expiresAt || new Date();
    const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()) + days * 24 * 60 * 60 * 1000);

    await prisma.license.update({
      where: { id: license.id },
      data: { expiresAt: newExpiry },
    });

    return { success: true, newExpiresAt: newExpiry.toISOString() };
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

  /** Downgrade a user from Pro to Free */
  async downgradeUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    // Deactivate active Pro licenses
    await prisma.license.updateMany({
      where: { userId, status: 'active', planId: 'pro' },
      data: { status: 'revoked' },
    });

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

    return { success: true };
  },
};
