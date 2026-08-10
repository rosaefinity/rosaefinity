"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = exports.UserService = void 0;
const user_repository_1 = require("../repositories/user.repository");
const api_error_1 = require("../utils/api-error");
const password_1 = require("../utils/password");
const prisma_1 = __importDefault(require("../config/prisma"));
class UserService {
    async getProfile(userId) {
        const user = await user_repository_1.userRepository.findById(userId);
        if (!user) {
            throw api_error_1.ApiError.notFound('User not found');
        }
        return {
            id: user.id,
            email: user.email,
            username: user.username,
            avatar: user.avatar,
            role: user.role,
            status: user.status,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
    async updateProfile(userId, data) {
        const user = await user_repository_1.userRepository.findById(userId);
        if (!user) {
            throw api_error_1.ApiError.notFound('User not found');
        }
        if (data.username && data.username !== user.username) {
            const existing = await user_repository_1.userRepository.findByUsername(data.username);
            if (existing) {
                throw api_error_1.ApiError.conflict('Username already exists');
            }
        }
        const updated = await user_repository_1.userRepository.update(userId, data);
        return {
            id: updated.id,
            email: updated.email,
            username: updated.username,
            avatar: updated.avatar,
        };
    }
    async deleteAccount(userId, password) {
        const user = await user_repository_1.userRepository.findById(userId);
        if (!user) {
            throw api_error_1.ApiError.notFound('User not found');
        }
        if (!user.passwordHash) {
            throw api_error_1.ApiError.badRequest('Cannot delete OAuth account this way');
        }
        const isValid = await (0, password_1.comparePassword)(password, user.passwordHash);
        if (!isValid) {
            throw api_error_1.ApiError.unauthorized('Invalid password');
        }
        await prisma_1.default.refreshTokens.deleteMany({ where: { userId } });
        await prisma_1.default.sessions.deleteMany({ where: { userId } });
        await user_repository_1.userRepository.delete(userId);
        return { message: 'Account deleted successfully' };
    }
}
exports.UserService = UserService;
exports.userService = new UserService();
//# sourceMappingURL=user.service.js.map