"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenseController = exports.LicenseController = void 0;
const license_service_1 = require("../services/license.service");
class LicenseController {
    async activateLicense(req, res, next) {
        try {
            const { licenseKey, hardwareFingerprint } = req.body;
            const result = await license_service_1.licenseService.activateLicense(req.user.userId, licenseKey, hardwareFingerprint);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async deactivateLicense(req, res, next) {
        try {
            const { licenseKey } = req.body;
            const result = await license_service_1.licenseService.deactivateLicense(req.user.userId, licenseKey);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async checkLicense(req, res, next) {
        try {
            const result = await license_service_1.licenseService.checkLicense(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.LicenseController = LicenseController;
exports.licenseController = new LicenseController();
//# sourceMappingURL=license.controller.js.map