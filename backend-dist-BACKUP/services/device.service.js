"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceService = exports.DeviceService = void 0;
const device_repository_1 = require("../repositories/device.repository");
const api_error_1 = require("../utils/api-error");
class DeviceService {
    async registerDevice(userId, deviceId, deviceName, os, cpu) {
        const existing = await device_repository_1.deviceRepository.findByDeviceId(deviceId);
        if (existing) {
            await device_repository_1.deviceRepository.update(existing.id, {
                lastLogin: new Date(),
                deviceName,
                os,
                cpu,
            });
            return existing;
        }
        return device_repository_1.deviceRepository.create({
            user: { connect: { id: userId } },
            deviceId,
            deviceName,
            os,
            cpu,
            lastLogin: new Date(),
        });
    }
    async listDevices(userId) {
        return device_repository_1.deviceRepository.findByUserId(userId);
    }
    async removeDevice(userId, deviceId) {
        const device = await device_repository_1.deviceRepository.findByDeviceId(deviceId);
        if (!device) {
            throw api_error_1.ApiError.notFound('Device not found');
        }
        if (device.userId !== userId) {
            throw api_error_1.ApiError.forbidden('Not authorized to remove this device');
        }
        await device_repository_1.deviceRepository.delete(device.id);
        return { message: 'Device removed successfully' };
    }
    async validateDevice(userId, deviceId) {
        const device = await device_repository_1.deviceRepository.findByDeviceId(deviceId);
        if (!device) {
            throw api_error_1.ApiError.notFound('Device not found');
        }
        if (device.userId !== userId) {
            throw api_error_1.ApiError.forbidden('Device does not belong to this user');
        }
        return device;
    }
}
exports.DeviceService = DeviceService;
exports.deviceService = new DeviceService();
//# sourceMappingURL=device.service.js.map