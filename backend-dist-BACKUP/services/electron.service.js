"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronService = exports.ElectronService = void 0;
const auth_service_1 = require("./auth.service");
const device_service_1 = require("./device.service");
const jwt_1 = require("../utils/jwt");
const api_error_1 = require("../utils/api-error");
class ElectronService {
    async login(email, password, deviceId, deviceName, os, cpu) {
        const authResult = await auth_service_1.authService.login(email, password);
        await device_service_1.deviceService.registerDevice(authResult.user.id, deviceId, deviceName, os, cpu);
        return {
            user: authResult.user,
            accessToken: authResult.accessToken,
            refreshToken: authResult.refreshToken,
        };
    }
    async refreshToken(refreshToken) {
        return auth_service_1.authService.refreshToken(refreshToken);
    }
    async validateToken(token) {
        try {
            const payload = (0, jwt_1.verifyToken)(token);
            return {
                valid: true,
                userId: payload.userId,
                email: payload.email,
                username: payload.username,
            };
        }
        catch {
            throw api_error_1.ApiError.unauthorized('Invalid or expired token');
        }
    }
    async logout(userId, refreshToken) {
        return auth_service_1.authService.logout(userId, refreshToken);
    }
}
exports.ElectronService = ElectronService;
exports.electronService = new ElectronService();
//# sourceMappingURL=electron.service.js.map