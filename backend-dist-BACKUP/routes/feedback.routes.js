"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const feedback_controller_1 = require("../controllers/feedback.controller");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const feedback_validator_1 = require("../validators/feedback.validator");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/feedback:
 *   post:
 *     tags: [Feedback]
 *     summary: Send feedback
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, subject, message]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [feedback, bug, feature]
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               appVersion:
 *                 type: string
 *               platform:
 *                 type: string
 *     responses:
 *       201:
 *         description: Feedback submitted
 */
router.post('/', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(feedback_validator_1.sendFeedbackSchema), feedback_controller_1.feedbackController.sendFeedback);
/**
 * @swagger
 * /api/feedback:
 *   get:
 *     tags: [Feedback]
 *     summary: Get feedback history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback history
 */
router.get('/', auth_middleware_1.authenticate, feedback_controller_1.feedbackController.getFeedbackHistory);
exports.default = router;
//# sourceMappingURL=feedback.routes.js.map