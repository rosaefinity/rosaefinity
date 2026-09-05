// =============================================
// RosaeFinity — License Service
// =============================================

import { licenseRepository } from './repository.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../middleware/error-handler.js';
import { generateLicenseKey, maskLicenseKey } from '../../../utils/helpers.js';
import { getPrisma } from '../../../database/client.js';

const prisma = getPrisma();

export const licenseService = {
  async activate(userId: string, licenseKey: string, deviceId: string, email?: string) {
    // Check existing active license
    const existing = await licenseRepository.findActiveByUserId(userId);
    if (existing && existing.planId !== 'free') {
      throw new BadRequestError('User already has an active license');
    }

    // Validate key format
    if (!/^ROSAE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licenseKey)) {
      throw new BadRequestError('Invalid license key format');
    }

    // Check if key exists and is not revoked
    const existingKey = await licenseRepository.findByKey(licenseKey);
    if (existingKey && existingKey.status === 'revoked') {
      throw new ForbiddenError('This license key has been revoked');
    }

    // Determine plan from key prefix
    const planId = licenseKey.startsWith('ROSAE-ENT') ? 'enterprise' : 'pro';
    const plan = await licenseRepository.getPlan(planId);
    if (!plan) throw new NotFoundError('Plan not found');

    // Check device limit
    const deviceCount = await prisma.device.count({
      where: { userId, status: 'active' },
    });
    if (deviceCount >= plan.maxDevices) {
      throw new BadRequestError(`Device limit reached (${plan.maxDevices}). Deactivate a device first.`);
    }

    // Create or update license
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    console.log('[LICENSE] Activating', JSON.stringify({
      userId,
      planId,
      licenseKey: licenseKey.substring(0, 10) + '...',
      expiresAt: expiresAt.toISOString(),
      timestamp: new Date().toISOString(),
    }));

    if (existingKey) {
      // Re-activate existing key
      const license = await licenseRepository.update(existingKey.id, {
        status: 'active',
        userId,
        expiresAt,
        email: email || existingKey.email,
        lastValidatedAt: new Date(),
      });
      return license;
    }

    // Create new license
    const license = await licenseRepository.create({
      userId,
      planId,
      licenseKey,
      email,
      expiresAt,
    });

    // Update user account type
    await prisma.user.update({ where: { id: userId }, data: { accountType: planId } });

    return license;
  },

  async deactivate(userId: string, deviceId: string) {
    const license = await licenseRepository.findActiveByUserId(userId);
    if (!license) throw new NotFoundError('No active license');

    await licenseRepository.update(license.id, { status: 'expired' });
    await prisma.user.update({ where: { id: userId }, data: { accountType: 'free' } });

    return { success: true, planTier: 'free' };
  },

  async getStatus(userId: string) {
    const license = await licenseRepository.findActiveByUserId(userId);
    if (!license) {
      return {
        status: 'none',
        planTier: 'free',
        features: [],
        limits: { maxActions: 5, maxSounds: 3, maxOverlays: 2, maxProfiles: 1, maxScreens: 2, maxPointsUsers: 2500, maxDevices: 1 },
        expiresAt: null,
      };
    }

    const now = Date.now();
    let status = license.status;
    if (license.expiresAt && now > license.expiresAt.getTime()) {
      const graceEnd = license.expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000;
      status = now <= graceEnd ? 'grace' : 'expired';
    }

    return {
      status,
      planTier: license.planId,
      features: license.plan.features,
      limits: {
        maxActions: license.plan.maxActions,
        maxSounds: license.plan.maxSounds,
        maxOverlays: license.plan.maxOverlays,
        maxProfiles: license.plan.maxProfiles,
        maxScreens: license.plan.maxScreens,
        maxPointsUsers: license.plan.maxPointsUsers,
        maxDevices: license.plan.maxDevices,
      },
      expiresAt: license.expiresAt,
      licenseKey: license.licenseKey ? maskLicenseKey(license.licenseKey) : null,
    };
  },

  async getAllPlans() {
    return licenseRepository.getAllPlans();
  },
};
