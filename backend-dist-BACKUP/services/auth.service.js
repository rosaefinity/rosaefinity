"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const user_repository_1 = require("../repositories/user.repository");
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const api_error_1 = require("../utils/api-error");
const prisma_1 = __importDefault(require("../config/prisma"));
class AuthService {
    async register(email, username, password) {
        const existingEmail = await user_repository_1.userRepository.findByEmail(email);
        if (existingEmail) {
            throw api_error_1.ApiError.conflict('Email already exists');
        }
        const existingUsername = await user_repository_1.userRepository.findByUsername(username);
        if (existingUsername) {
            throw api_error_1.ApiError.conflict('Username already exists');
        }
        const passwordHash = await (0, password_1.hashPassword)(password);
        const user = await user_repository_1.userRepository.create({
            email,
            username,
            passwordHash,
            emailVerified: false,
            role: 'user',
            status: 'active',
        });
        const payload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
        };
        const accessToken = (0, jwt_1.generateAccessToken)(payload);
        const refreshToken = (0, jwt_1.generateRefreshToken)(payload);
        await prisma_1.default.refreshTokens.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        return {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
            },
            accessToken,
            refreshToken,
        };
    }
    async login(email, password) {
        const user = await user_repository_1.userRepository.findByEmail(email);
        if (!user || !user.passwordHash) {
            throw api_error_1.ApiError.unauthorized('Invalid email or password');
        }
        if (user.status === 'suspended') {
            throw api_error_1.ApiError.forbidden('Account is suspended');
        }
        const isValidPassword = await (0, password_1.comparePassword)(password, user.passwordHash);
        if (!isValidPassword) {
            throw api_error_1.ApiError.unauthorized('Invalid email or password');
        }
        const payload = {
            userId: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
        };
        const accessToken = (0, jwt_1.generateAccessToken)(payload);
        const refreshToken = (0, jwt_1.generateRefreshToken)(payload);
        await prisma_1.default.refreshTokens.create({
            data: {
                userId: user.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        return {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                avatar: user.avatar,
            },
            accessToken,
            refreshToken,
        };
    }
    async refreshToken(refreshToken) {
        const tokenRecord = await prisma_1.default.refreshTokens.findUnique({
            where: { token: refreshToken },
        });
        if (!tokenRecord || tokenRecord.revokedAt) {
            throw api_error_1.ApiError.unauthorized('Invalid refresh token');
        }
        if (tokenRecord.expiresAt < new Date()) {
            throw api_error_1.ApiError.unauthorized('Refresh token expired');
        }
        const payload = (0, jwt_1.verifyToken)(refreshToken);
        await prisma_1.default.refreshTokens.update({
            where: { id: tokenRecord.id },
            data: { revokedAt: new Date() },
        });
        const newPayload = {
            userId: payload.userId,
            email: payload.email,
            username: payload.username,
            role: payload.role,
        };
        const newAccessToken = (0, jwt_1.generateAccessToken)(newPayload);
        const newRefreshToken = (0, jwt_1.generateRefreshToken)(newPayload);
        await prisma_1.default.refreshTokens.create({
            data: {
                userId: payload.userId,
                token: newRefreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };
    }
    async getMe(userId) {
        const user = await user_repository_1.userRepository.findById(userId);
        if (!user) {
            throw api_error_1.ApiError.notFound('User not found');
        }
        return {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            avatar: user.avatar,
            status: user.status,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
        };
    }
    async logout(userId, refreshToken) {
        await prisma_1.default.refreshTokens.updateMany({
            where: { userId, token: refreshToken },
            data: { revokedAt: new Date() },
        });
    }
    async logoutAll(userId) {
        await prisma_1.default.refreshTokens.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    async forgotPassword(email) {
        const user = await user_repository_1.userRepository.findByEmail(email);
        if (!user) {
            return { message: 'If the email exists, a reset link has been sent' };
        }
        const token = (0, jwt_1.generateAccessToken)({
            userId: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
        });
        await prisma_1.default.passwordResetTokens.create({
            data: {
                userId: user.id,
                token,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
        });
        return { message: 'If the email exists, a reset link has been sent' };
    }
    async resetPassword(token, password) {
        const resetToken = await prisma_1.default.passwordResetTokens.findUnique({
            where: { token },
        });
        if (!resetToken || resetToken.usedAt) {
            throw api_error_1.ApiError.badRequest('Invalid or used reset token');
        }
        if (resetToken.expiresAt < new Date()) {
            throw api_error_1.ApiError.badRequest('Reset token expired');
        }
        const passwordHash = await (0, password_1.hashPassword)(password);
        await user_repository_1.userRepository.update(resetToken.userId, { passwordHash });
        await prisma_1.default.passwordResetTokens.update({
            where: { id: resetToken.id },
            data: { usedAt: new Date() },
        });
        await prisma_1.default.refreshTokens.updateMany({
            where: { userId: resetToken.userId },
            data: { revokedAt: new Date() },
        });
        return { message: 'Password reset successfully' };
    }
    async verifyEmail(token) {
        const verificationToken = await prisma_1.default.emailVerification.findUnique({
            where: { token },
        });
        if (!verificationToken || verificationToken.verifiedAt) {
            throw api_error_1.ApiError.badRequest('Invalid or used verification token');
        }
        if (verificationToken.expiresAt < new Date()) {
            throw api_error_1.ApiError.badRequest('Verification token expired');
        }
        await user_repository_1.userRepository.update(verificationToken.userId, {
            emailVerified: true,
        });
        await prisma_1.default.emailVerification.update({
            where: { id: verificationToken.id },
            data: { verifiedAt: new Date() },
        });
        return { message: 'Email verified successfully' };
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map