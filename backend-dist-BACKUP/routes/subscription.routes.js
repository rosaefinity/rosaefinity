"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const subscription_validator_1 = require("../validators/subscription.validator");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/subscription:
 *   get:
 *     tags: [Subscription]
 *     summary: Get current subscription plan
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current plan
 */
router.get('/', auth_middleware_1.authenticate, subscription_controller_1.subscriptionController.getCurrentPlan);
/**
 * @swagger
 * /api/subscription/upgrade:
 *   post:
 *     tags: [Subscription]
 *     summary: Upgrade subscription plan
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan]
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [pro, business]
 *     responses:
 *       200:
 *         description: Plan upgraded
 */
router.post('/upgrade', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(subscription_validator_1.upgradeSchema), subscription_controller_1.subscriptionController.upgrade);
/**
 * @swagger
 * /api/subscription/downgrade:
 *   post:
 *     tags: [Subscription]
 *     summary: Downgrade to free plan
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Plan downgraded
 */
router.post('/downgrade', auth_middleware_1.authenticate, subscription_controller_1.subscriptionController.downgrade);
/**
 * @swagger
 * /api/subscription/cancel:
 *   post:
 *     tags: [Subscription]
 *     summary: Cancel subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription cancelled
 */
router.post('/cancel', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(subscription_validator_1.cancelSchema), subscription_controller_1.subscriptionController.cancel);
/**
 * @swagger
 * /api/subscription/renew:
 *   post:
 *     tags: [Subscription]
 *     summary: Renew subscription
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription renewed
 */
router.post('/renew', auth_middleware_1.authenticate, subscription_controller_1.subscriptionController.renew);
exports.default = router;
//# sourceMappingURL=subscription.routes.js.map