"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceController = exports.DeviceController = void 0;
const device_service_1 = require("../services/device.service");
class DeviceController {
    async registerDevice(req, res, next) {
        try {
            const { deviceId, deviceName, os, cpu } = req.body;
            const result = await device_service_1.deviceService.registerDevice(req.user.userId, deviceId, deviceName, os, cpu);
            res.status(201).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async listDevices(req, res, next) {
        try {
            const result = await device_service_1.deviceService.listDevices(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async removeDevice(req, res, next) {
        try {
            const { deviceId } = req.params;
            const result = await device_service_1.deviceService.removeDevice(req.user.userId, deviceId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async validateDevice(req, res, next) {
        try {
            const { deviceId } = req.body;
            const result = await device_service_1.deviceService.validateDevice(req.user.userId, deviceId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.DeviceController = DeviceController;
exports.deviceController = new DeviceController();
//# sourceMappingURL=device.controller.js.map