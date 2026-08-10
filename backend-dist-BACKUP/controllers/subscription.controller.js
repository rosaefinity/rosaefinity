"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionController = exports.SubscriptionController = void 0;
const subscription_service_1 = require("../services/subscription.service");
class SubscriptionController {
    async getCurrentPlan(req, res, next) {
        try {
            const result = await subscription_service_1.subscriptionService.getCurrentPlan(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async upgrade(req, res, next) {
        try {
            const { plan } = req.body;
            const result = await subscription_service_1.subscriptionService.upgrade(req.user.userId, plan);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async downgrade(req, res, next) {
        try {
            const result = await subscription_service_1.subscriptionService.downgrade(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async cancel(req, res, next) {
        try {
            const result = await subscription_service_1.subscriptionService.cancel(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async renew(req, res, next) {
        try {
            const result = await subscription_service_1.subscriptionService.renew(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SubscriptionController = SubscriptionController;
exports.subscriptionController = new SubscriptionController();
//# sourceMappingURL=subscription.controller.js.map