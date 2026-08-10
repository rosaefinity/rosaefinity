"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateController = exports.UpdateController = void 0;
const update_service_1 = require("../services/update.service");
class UpdateController {
    async checkForUpdate(req, res, next) {
        try {
            const { version, platform } = req.query;
            const result = await update_service_1.updateService.checkForUpdate(version, platform || 'windows');
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getLatestVersion(req, res, next) {
        try {
            const { platform } = req.query;
            const result = await update_service_1.updateService.getLatestVersion(platform || 'windows');
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getVersionHistory(req, res, next) {
        try {
            const { platform } = req.query;
            const result = await update_service_1.updateService.getVersionHistory(platform || 'windows');
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UpdateController = UpdateController;
exports.updateController = new UpdateController();
//# sourceMappingURL=update.controller.js.map