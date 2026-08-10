// =============================================
// RosaeFinity — Device Service
// =============================================

import { deviceRepository } from './repository.js';
import { BadRequestError, NotFoundError } from '../../middleware/error-handler.js';

export const deviceService = {
  async register(userId: string, data: { deviceId: string; name: string; platform: string; appVersion?: string; machineFingerprint?: string }) {
    // Check if device already exists
    const existing = await deviceRepository.findByDeviceId(data.deviceId);
    if (existing) {
      // Update last seen
      await deviceRepository.update(existing.id, {
        lastSeenAt: new Date(),
        appVersion: data.appVersion || existing.appVersion,
        name: data.name,
      });
      return existing;
    }

    // Create new device
    const device = await deviceRepository.create({ userId, ...data });
    return device;
  },

  async list(userId: string) {
    return deviceRepository.findByUserId(userId);
  },

  async deactivate(userId: string, deviceId: string) {
    const device = await deviceRepository.findByDeviceId(deviceId);
    if (!device) throw new NotFoundError('Device not found');
    if (device.userId !== userId) throw new BadRequestError('Not your device');

    await deviceRepository.deactivate(device.id);
    return { success: true };
  },

  async revokeAdmin(deviceId: string) {
    const device = await deviceRepository.findByDeviceId(deviceId);
    if (!device) throw new NotFoundError('Device not found');

    await deviceRepository.revoke(device.id);
    return { success: true };
  },

  async rename(userId: string, deviceId: string, name: string) {
    const device = await deviceRepository.findByDeviceId(deviceId);
    if (!device) throw new NotFoundError('Device not found');
    if (device.userId !== userId) throw new BadRequestError('Not your device');

    await deviceRepository.update(device.id, { name });
    return { success: true };
  },

  async touch(deviceId: string) {
    await deviceRepository.touchLastSeen(deviceId);
  },

  async getActiveCount(userId: string) {
    return deviceRepository.countActiveByUserId(userId);
  },
};
