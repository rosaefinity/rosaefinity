"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_controller_1 = require("../controllers/health.controller");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', health_controller_1.healthController.health);
/**
 * @swagger
 * /api/version:
 *   get:
 *     tags: [Health]
 *     summary: Get API version
 *     responses:
 *       200:
 *         description: Version information
 */
router.get('/version', health_controller_1.healthController.version);
/**
 * @swagger
 * /api/status:
 *   get:
 *     tags: [Health]
 *     summary: Get service status
 *     responses:
 *       200:
 *         description: Service status
 */
router.get('/status', health_controller_1.healthController.status);
exports.default = router;
//# sourceMappingURL=health.routes.js.map