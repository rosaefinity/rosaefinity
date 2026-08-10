"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const update_controller_1 = require("../controllers/update.controller");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/update/check:
 *   get:
 *     tags: [Update]
 *     summary: Check for updates
 *     parameters:
 *       - in: query
 *         name: version
 *         required: true
 *         schema:
 *           type: string
 *         description: Current app version
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [windows, macos, linux]
 *     responses:
 *       200:
 *         description: Update information
 */
router.get('/check', update_controller_1.updateController.checkForUpdate);
/**
 * @swagger
 * /api/update/latest:
 *   get:
 *     tags: [Update]
 *     summary: Get latest version
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [windows, macos, linux]
 *     responses:
 *       200:
 *         description: Latest version info
 */
router.get('/latest', update_controller_1.updateController.getLatestVersion);
/**
 * @swagger
 * /api/update/history:
 *   get:
 *     tags: [Update]
 *     summary: Get version history
 *     parameters:
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [windows, macos, linux]
 *     responses:
 *       200:
 *         description: Version history
 */
router.get('/history', update_controller_1.updateController.getVersionHistory);
exports.default = router;
//# sourceMappingURL=update.routes.js.map