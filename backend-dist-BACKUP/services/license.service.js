"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenseService = exports.LicenseService = void 0;
const license_repository_1 = require("../repositories/license.repository");
const api_error_1 = require("../utils/api-error");
class LicenseService {
    async activateLicense(userId, licenseKey, hardwareFingerprint) {
        const license = await license_repository_1.licenseRepository.findByKey(licenseKey);
        if (!license) {
            throw api_error_1.ApiError.notFound('Invalid license key');
        }
        if (license.status === 'revoked') {
            throw api_error_1.ApiError.forbidden('License has been revoked');
        }
        if (license.expiredAt && license.expiredAt < new Date()) {
            throw api_error_1.ApiError.badRequest('License has expired');
        }
        const updated = await license_repository_1.licenseRepository.update(license.id, {
            user: { connect: { id: userId } },
            status: 'active',
            activatedAt: new Date(),
            hardwareFingerprint,
        });
        await license_repository_1.licenseRepository.createActivationHistory({
            license: { connect: { id: license.id } },
            user: { connect: { id: userId } },
            hardwareFingerprint,
            action: 'activated',
        });
        return {
            licenseKey: updated.licenseKey,
            type: updated.type,
            status: updated.status,
            activatedAt: updated.activatedAt,
            expiredAt: updated.expiredAt,
        };
    }
    async deactivateLicense(userId, licenseKey) {
        const license = await license_repository_1.licenseRepository.findByKey(licenseKey);
        if (!license) {
            throw api_error_1.ApiError.notFound('License not found');
        }
        if (license.userId !== userId) {
            throw api_error_1.ApiError.forbidden('Not authorized to deactivate this license');
        }
        const updated = await license_repository_1.licenseRepository.update(license.id, {
            status: 'expired',
        });
        await license_repository_1.licenseRepository.createActivationHistory({
            license: { connect: { id: license.id } },
            user: { connect: { id: userId } },
            action: 'deactivated',
        });
        return {
            licenseKey: updated.licenseKey,
            status: updated.status,
        };
    }
    async checkLicense(userId) {
        const license = await license_repository_1.licenseRepository.findByUserId(userId);
        if (!license) {
            return { hasLicense: false };
        }
        return {
            hasLicense: true,
            licenseKey: license.licenseKey,
            type: license.type,
            status: license.status,
            activatedAt: license.activatedAt,
            expiredAt: license.expiredAt,
        };
    }
}
exports.LicenseService = LicenseService;
exports.licenseService = new LicenseService();
//# sourceMappingURL=license.service.js.map