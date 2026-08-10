"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const license_controller_1 = require("../controllers/license.controller");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const license_validator_1 = require("../validators/license.validator");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/license/activate:
 *   post:
 *     tags: [License]
 *     summary: Activate a license
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [licenseKey]
 *             properties:
 *               licenseKey:
 *                 type: string
 *               hardwareFingerprint:
 *                 type: string
 *     responses:
 *       200:
 *         description: License activated
 */
router.post('/activate', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(license_validator_1.activateLicenseSchema), license_controller_1.licenseController.activateLicense);
/**
 * @swagger
 * /api/license/deactivate:
 *   post:
 *     tags: [License]
 *     summary: Deactivate a license
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [licenseKey]
 *             properties:
 *               licenseKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: License deactivated
 */
router.post('/deactivate', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(license_validator_1.deactivateLicenseSchema), license_controller_1.licenseController.deactivateLicense);
/**
 * @swagger
 * /api/license/check:
 *   get:
 *     tags: [License]
 *     summary: Check license status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: License status
 */
router.get('/check', auth_middleware_1.authenticate, license_controller_1.licenseController.checkLicense);
exports.default = router;
//# sourceMappingURL=license.routes.js.map