"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionRepository = exports.SubscriptionRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
class SubscriptionRepository {
    async findByUserId(userId) {
        return prisma_1.default.subscriptions.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findById(id) {
        return prisma_1.default.subscriptions.findUnique({ where: { id } });
    }
    async create(data) {
        return prisma_1.default.subscriptions.create({ data });
    }
    async update(id, data) {
        return prisma_1.default.subscriptions.update({ where: { id }, data });
    }
    async createPayment(data) {
        return prisma_1.default.payments.create({ data });
    }
}
exports.SubscriptionRepository = SubscriptionRepository;
exports.subscriptionRepository = new SubscriptionRepository();
//# sourceMappingURL=subscription.repository.js.map