"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlagController = exports.FeatureFlagController = void 0;
const feature_flag_service_1 = require("../services/feature-flag.service");
class FeatureFlagController {
    async getFeatures(req, res, next) {
        try {
            const result = await feature_flag_service_1.featureFlagService.getFeaturesForUser(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getAllFeatures(_req, res, next) {
        try {
            const result = await feature_flag_service_1.featureFlagService.getAllFeatures();
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.FeatureFlagController = FeatureFlagController;
exports.featureFlagController = new FeatureFlagController();
//# sourceMappingURL=feature-flag.controller.js.map