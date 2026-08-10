"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlagService = exports.FeatureFlagService = void 0;
const feature_flag_repository_1 = require("../repositories/feature-flag.repository");
const subscription_service_1 = require("./subscription.service");
class FeatureFlagService {
    async getFeaturesForUser(userId) {
        const subscription = await subscription_service_1.subscriptionService.getCurrentPlan(userId);
        const plan = subscription.plan;
        const flags = {
            cloudSync: plan !== 'free',
            proOverlays: plan === 'pro' || plan === 'business',
            advancedAlerts: plan === 'pro' || plan === 'business',
            multiScreen: plan === 'business',
            customThemes: plan === 'pro' || plan === 'business',
            prioritySupport: plan === 'business',
        };
        const dbFlags = await feature_flag_repository_1.featureFlagRepository.findAllEnabled();
        for (const flag of dbFlags) {
            if (flag.key in flags) {
                const key = flag.key;
                flags[key] = true;
            }
        }
        return flags;
    }
    async getAllFeatures() {
        return feature_flag_repository_1.featureFlagRepository.findAllEnabled();
    }
}
exports.FeatureFlagService = FeatureFlagService;
exports.featureFlagService = new FeatureFlagService();
//# sourceMappingURL=feature-flag.service.js.map