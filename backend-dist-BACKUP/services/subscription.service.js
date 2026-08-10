"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionService = exports.SubscriptionService = void 0;
const subscription_repository_1 = require("../repositories/subscription.repository");
const api_error_1 = require("../utils/api-error");
class SubscriptionService {
    async getCurrentPlan(userId) {
        const subscription = await subscription_repository_1.subscriptionRepository.findByUserId(userId);
        if (!subscription) {
            return {
                plan: 'free',
                status: 'active',
                startDate: null,
                endDate: null,
                autoRenew: false,
            };
        }
        return {
            plan: subscription.plan,
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            autoRenew: subscription.autoRenew,
            externalId: subscription.externalId,
        };
    }
    async upgrade(userId, plan) {
        const current = await subscription_repository_1.subscriptionRepository.findByUserId(userId);
        if (current && current.plan === plan && current.status === 'active') {
            throw api_error_1.ApiError.badRequest('Already on this plan');
        }
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);
        if (current) {
            await subscription_repository_1.subscriptionRepository.update(current.id, {
                status: 'cancelled',
            });
        }
        const subscription = await subscription_repository_1.subscriptionRepository.create({
            user: { connect: { id: userId } },
            plan,
            status: 'active',
            startDate,
            endDate,
            autoRenew: true,
        });
        await subscription_repository_1.subscriptionRepository.createPayment({
            subscription: { connect: { id: subscription.id } },
            user: { connect: { id: userId } },
            invoice: `INV-${Date.now()}`,
            gateway: 'stripe',
            amount: plan === 'pro' ? 9.99 : 29.99,
            currency: 'USD',
            paymentStatus: 'completed',
            paidAt: new Date(),
        });
        return {
            plan: subscription.plan,
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
        };
    }
    async downgrade(userId) {
        const current = await subscription_repository_1.subscriptionRepository.findByUserId(userId);
        if (!current || current.plan === 'free') {
            throw api_error_1.ApiError.badRequest('No active paid subscription');
        }
        await subscription_repository_1.subscriptionRepository.update(current.id, {
            plan: 'free',
        });
        return {
            plan: 'free',
            status: 'active',
        };
    }
    async cancel(userId) {
        const current = await subscription_repository_1.subscriptionRepository.findByUserId(userId);
        if (!current || current.plan === 'free') {
            throw api_error_1.ApiError.badRequest('No active subscription to cancel');
        }
        await subscription_repository_1.subscriptionRepository.update(current.id, {
            status: 'cancelled',
            autoRenew: false,
        });
        return {
            message: 'Subscription cancelled. You will have access until the end of the billing period.',
        };
    }
    async renew(userId) {
        const current = await subscription_repository_1.subscriptionRepository.findByUserId(userId);
        if (!current) {
            throw api_error_1.ApiError.notFound('No subscription found');
        }
        const newEndDate = new Date(current.endDate);
        newEndDate.setMonth(newEndDate.getMonth() + 1);
        await subscription_repository_1.subscriptionRepository.update(current.id, {
            endDate: newEndDate,
            status: 'active',
        });
        return {
            plan: current.plan,
            status: 'active',
            endDate: newEndDate,
        };
    }
}
exports.SubscriptionService = SubscriptionService;
exports.subscriptionService = new SubscriptionService();
//# sourceMappingURL=subscription.service.js.map