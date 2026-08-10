"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronController = exports.ElectronController = void 0;
const electron_service_1 = require("../services/electron.service");
class ElectronController {
    async login(req, res, next) {
        try {
            const { email, password, deviceId, deviceName, os, cpu } = req.body;
            const result = await electron_service_1.electronService.login(email, password, deviceId, deviceName, os, cpu);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;
            const result = await electron_service_1.electronService.refreshToken(refreshToken);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async validateToken(req, res, next) {
        try {
            const { token } = req.body;
            const result = await electron_service_1.electronService.validateToken(token);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async logout(req, res, next) {
        try {
            const { refreshToken } = req.body;
            await electron_service_1.electronService.logout(req.user.userId, refreshToken);
            res.json({ success: true, message: 'Logged out successfully' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ElectronController = ElectronController;
exports.electronController = new ElectronController();
//# sourceMappingURL=electron.controller.js.map