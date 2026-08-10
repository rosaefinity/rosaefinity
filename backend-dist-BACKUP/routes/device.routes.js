"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const device_controller_1 = require("../controllers/device.controller");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const device_validator_1 = require("../validators/device.validator");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/device:
 *   post:
 *     tags: [Device]
 *     summary: Register a new device
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId, deviceName, os]
 *             properties:
 *               deviceId:
 *                 type: string
 *               deviceName:
 *                 type: string
 *               os:
 *                 type: string
 *               cpu:
 *                 type: string
 *     responses:
 *       201:
 *         description: Device registered
 */
router.post('/', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(device_validator_1.registerDeviceSchema), device_controller_1.deviceController.registerDevice);
/**
 * @swagger
 * /api/device:
 *   get:
 *     tags: [Device]
 *     summary: List all devices
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of devices
 */
router.get('/', auth_middleware_1.authenticate, device_controller_1.deviceController.listDevices);
/**
 * @swagger
 * /api/device/{deviceId}:
 *   delete:
 *     tags: [Device]
 *     summary: Remove a device
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Device removed
 */
router.delete('/:deviceId', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(device_validator_1.removeDeviceSchema), device_controller_1.deviceController.removeDevice);
/**
 * @swagger
 * /api/device/validate:
 *   post:
 *     tags: [Device]
 *     summary: Validate a device
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId]
 *             properties:
 *               deviceId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device validated
 */
router.post('/validate', auth_middleware_1.authenticate, device_controller_1.deviceController.validateDevice);
exports.default = router;
//# sourceMappingURL=device.routes.js.map