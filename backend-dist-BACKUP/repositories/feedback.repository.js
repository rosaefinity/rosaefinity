"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackRepository = exports.FeedbackRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
class FeedbackRepository {
    async create(data) {
        return prisma_1.default.webhookLogs.create({
            data: {
                userId: data.userId,
                event: `feedback.${data.type}`,
                endpoint: 'feedback',
                statusCode: 200,
                requestBody: JSON.stringify({
                    subject: data.subject,
                    message: data.message,
                    email: data.email,
                    appVersion: data.appVersion,
                    platform: data.platform,
                }),
                durationMs: 0,
                success: true,
            },
        });
    }
    async findByUserId(userId) {
        return prisma_1.default.webhookLogs.findMany({
            where: {
                userId,
                event: { startsWith: 'feedback.' },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
}
exports.FeedbackRepository = FeedbackRepository;
exports.feedbackRepository = new FeedbackRepository();
//# sourceMappingURL=feedback.repository.js.map