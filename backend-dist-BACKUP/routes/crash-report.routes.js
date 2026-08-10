"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crash_report_controller_1 = require("../controllers/crash-report.controller");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const crash_report_validator_1 = require("../validators/crash-report.validator");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/crash-reports:
 *   post:
 *     tags: [Crash Reports]
 *     summary: Submit a crash report
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [appVersion, platform, stackTrace]
 *             properties:
 *               appVersion:
 *                 type: string
 *               platform:
 *                 type: string
 *               stackTrace:
 *                 type: string
 *               systemInfo:
 *                 type: object
 *               deviceId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Crash report submitted
 */
router.post('/', (0, validate_middleware_1.validate)(crash_report_validator_1.submitCrashReportSchema), crash_report_controller_1.crashReportController.submitCrashReport);
/**
 * @swagger
 * /api/crash-reports:
 *   get:
 *     tags: [Crash Reports]
 *     summary: Get crash report history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Crash report history
 */
router.get('/', auth_middleware_1.authenticate, crash_report_controller_1.crashReportController.getCrashReportHistory);
/**
 * @swagger
 * /api/crash-reports/{id}:
 *   get:
 *     tags: [Crash Reports]
 *     summary: Get crash report details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Crash report details
 */
router.get('/:id', auth_middleware_1.authenticate, crash_report_controller_1.crashReportController.getCrashReportDetails);
/**
 * @swagger
 * /api/crash-reports/{id}/status:
 *   put:
 *     tags: [Crash Reports]
 *     summary: Update crash report status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [new, investigating, resolved, wont_fix]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.put('/:id/status', auth_middleware_1.authenticate, crash_report_controller_1.crashReportController.updateCrashReportStatus);
exports.default = router;
//# sourceMappingURL=crash-report.routes.js.map