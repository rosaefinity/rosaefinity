"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feedbackController = exports.FeedbackController = void 0;
const feedback_service_1 = require("../services/feedback.service");
class FeedbackController {
    async sendFeedback(req, res, next) {
        try {
            const result = await feedback_service_1.feedbackService.sendFeedback(req.user.userId, req.body);
            res.status(201).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getFeedbackHistory(req, res, next) {
        try {
            const result = await feedback_service_1.feedbackService.getFeedbackHistory(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.FeedbackController = FeedbackController;
exports.feedbackController = new FeedbackController();
//# sourceMappingURL=feedback.controller.js.map