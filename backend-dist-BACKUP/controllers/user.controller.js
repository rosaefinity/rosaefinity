"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = exports.UserController = void 0;
const user_service_1 = require("../services/user.service");
class UserController {
    async getProfile(req, res, next) {
        try {
            const result = await user_service_1.userService.getProfile(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async updateProfile(req, res, next) {
        try {
            const result = await user_service_1.userService.updateProfile(req.user.userId, req.body);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async deleteAccount(req, res, next) {
        try {
            const { password } = req.body;
            const result = await user_service_1.userService.deleteAccount(req.user.userId, password);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UserController = UserController;
exports.userController = new UserController();
//# sourceMappingURL=user.controller.js.map