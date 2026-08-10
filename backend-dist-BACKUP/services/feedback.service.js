"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackService = exports.FeedbackService = void 0;
const feedback_repository_1 = require("../repositories/feedback.repository");
class FeedbackService {
    async sendFeedback(userId, data) {
        const feedback = await feedback_repository_1.feedbackRepository.create({
            userId,
            ...data,
        });
        return {
            id: feedback.id,
            type: data.type,
            subject: data.subject,
            message: 'Feedback submitted successfully',
            createdAt: feedback.createdAt,
        };
    }
    async getFeedbackHistory(userId) {
        const feedbacks = await feedback_repository_1.feedbackRepository.findByUserId(userId);
        return feedbacks.map((f) => ({
            id: f.id,
            event: f.event,
            createdAt: f.createdAt,
        }));
    }
}
exports.FeedbackService = FeedbackService;
exports.feedbackService = new FeedbackService();
//# sourceMappingURL=feedback.service.js.map