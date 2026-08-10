"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
class AuthController {
    async register(req, res, next) {
        try {
            const { email, username, password } = req.body;
            const result = await auth_service_1.authService.register(email, username, password);
            res.status(201).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await auth_service_1.authService.login(email, password);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;
            const result = await auth_service_1.authService.refreshToken(refreshToken);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async logout(req, res, next) {
        try {
            const { refreshToken } = req.body;
            await auth_service_1.authService.logout(req.user.userId, refreshToken);
            res.json({ success: true, message: 'Logged out successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    async logoutAll(req, res, next) {
        try {
            await auth_service_1.authService.logoutAll(req.user.userId);
            res.json({ success: true, message: 'Logged out from all devices' });
        }
        catch (error) {
            next(error);
        }
    }
    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            const result = await auth_service_1.authService.forgotPassword(email);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async resetPassword(req, res, next) {
        try {
            const { token, password } = req.body;
            const result = await auth_service_1.authService.resetPassword(token, password);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async verifyEmail(req, res, next) {
        try {
            const { token } = req.body;
            const result = await auth_service_1.authService.verifyEmail(token);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async me(req, res, next) {
        try {
            const result = await auth_service_1.authService.getMe(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map