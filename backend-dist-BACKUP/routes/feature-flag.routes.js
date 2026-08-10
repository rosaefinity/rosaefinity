"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const feature_flag_controller_1 = require("../controllers/feature-flag.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/feature-flags:
 *   get:
 *     tags: [Feature Flags]
 *     summary: Get features for current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feature flags based on subscription
 */
router.get('/', auth_middleware_1.authenticate, feature_flag_controller_1.featureFlagController.getFeatures);
/**
 * @swagger
 * /api/feature-flags/all:
 *   get:
 *     tags: [Feature Flags]
 *     summary: Get all enabled feature flags
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All enabled feature flags
 */
router.get('/all', auth_middleware_1.authenticate, feature_flag_controller_1.featureFlagController.getAllFeatures);
exports.default = router;
//# sourceMappingURL=feature-flag.routes.js.map