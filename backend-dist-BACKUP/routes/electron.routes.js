"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const electron_controller_1 = require("../controllers/electron.controller");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limit_middleware_1 = require("../middleware/rate-limit.middleware");
const electron_validator_1 = require("../validators/electron.validator");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/electron/login:
 *   post:
 *     tags: [Electron]
 *     summary: Login from Electron app
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, deviceId, deviceName, os]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               deviceId:
 *                 type: string
 *               deviceName:
 *                 type: string
 *               os:
 *                 type: string
 *               cpu:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login', rate_limit_middleware_1.strictRateLimiter, (0, validate_middleware_1.validate)(electron_validator_1.electronLoginSchema), electron_controller_1.electronController.login);
/**
 * @swagger
 * /api/electron/refresh:
 *   post:
 *     tags: [Electron]
 *     summary: Refresh token from Electron
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 */
router.post('/refresh', (0, validate_middleware_1.validate)(electron_validator_1.electronRefreshSchema), electron_controller_1.electronController.refreshToken);
/**
 * @swagger
 * /api/electron/validate:
 *   post:
 *     tags: [Electron]
 *     summary: Validate token from Electron
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token is valid
 */
router.post('/validate', (0, validate_middleware_1.validate)(electron_validator_1.electronValidateSchema), electron_controller_1.electronController.validateToken);
/**
 * @swagger
 * /api/electron/logout:
 *   post:
 *     tags: [Electron]
 *     summary: Logout from Electron
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout', auth_middleware_1.authenticate, electron_controller_1.electronController.logout);
exports.default = router;
//# sourceMappingURL=electron.routes.js.map