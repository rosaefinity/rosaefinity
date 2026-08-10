"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sync_controller_1 = require("../controllers/sync.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/sync/metadata:
 *   get:
 *     tags: [Sync]
 *     summary: Get sync metadata
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync metadata with timestamps
 */
router.get('/metadata', auth_middleware_1.authenticate, sync_controller_1.syncController.getSyncMetadata);
/**
 * @swagger
 * /api/sync/pull:
 *   get:
 *     tags: [Sync]
 *     summary: Pull updates from server
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lastSync
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Last sync timestamp
 *     responses:
 *       200:
 *         description: Updates since last sync
 */
router.get('/pull', auth_middleware_1.authenticate, sync_controller_1.syncController.pullUpdates);
/**
 * @swagger
 * /api/sync/push:
 *   post:
 *     tags: [Sync]
 *     summary: Push updates to server
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId, updates]
 *             properties:
 *               deviceId:
 *                 type: string
 *               updates:
 *                 type: object
 *                 description: Table updates
 *     responses:
 *       200:
 *         description: Sync results
 */
router.post('/push', auth_middleware_1.authenticate, sync_controller_1.syncController.pushUpdates);
/**
 * @swagger
 * /api/sync/resolve:
 *   post:
 *     tags: [Sync]
 *     summary: Resolve sync conflict
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [table, recordId, resolution]
 *             properties:
 *               table:
 *                 type: string
 *               recordId:
 *                 type: string
 *               resolution:
 *                 type: string
 *                 enum: [local, remote]
 *     responses:
 *       200:
 *         description: Conflict resolved
 */
router.post('/resolve', auth_middleware_1.authenticate, sync_controller_1.syncController.resolveConflict);
exports.default = router;
//# sourceMappingURL=sync.routes.js.map