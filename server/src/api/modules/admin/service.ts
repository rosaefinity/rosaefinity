// =============================================
// RosaeFinity — Admin Service
// =============================================

import { adminRepository } from './repository.js';
import { getPrisma } from '../../../database/client.js';
import { NotFoundError, BadRequestError } from '../../middleware/error-handler.js';

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

  /** Activate a Pro license for a specific user (admin action) */
  async activateForUser(userId: string, licenseKey: string, deviceId: string, email?: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    // Check if user already has an active non-free license
    const existingLicense = await prisma.license.findFirst({
      where: { userId, status: { in: ['active', 'grace'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existingLicense && existingLicense.planId !== 'free') {
      throw new BadRequestError(`User already has an active ${existingLicense.planId} license. Deactivate it first.`);
    }

    // Determine plan from key prefix
    const planId = licenseKey.startsWith('ROSAE-ENT') ? 'enterprise' : 'pro';
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundError('Plan not found');

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    // Check if key already exists
    const existingKey = await prisma.license.findUnique({ where: { licenseKey } });
    if (existingKey) {
      // Re-activate existing key for this user
      const license = await prisma.license.update({
        where: { id: existingKey.id },
        data: { status: 'active', userId, expiresAt, email: email || existingKey.email, lastValidatedAt: new Date() },
        include: { plan: true },
      });
      await prisma.user.update({ where: { id: userId }, data: { accountType: planId } });
      return license;
    }

    // Create new license
    const license = await prisma.license.create({
      data: { userId, planId, licenseKey, email, expiresAt },
      include: { plan: true },
    });

    // Update user account type
    await prisma.user.update({ where: { id: userId }, data: { accountType: planId } });

    return license;
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
