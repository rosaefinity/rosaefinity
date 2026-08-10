"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const prisma_1 = __importDefault(require("../config/prisma"));
const router = (0, express_1.Router)();
// All admin routes require authentication + admin role
router.use(auth_middleware_1.authenticate);
router.use(role_middleware_1.requireAdmin);
// Dashboard stats
router.get('/dashboard/stats', async (_req, res) => {
    try {
        const [totalUsers, activeUsers, proUsers, activeLicenses, crashReports, feedback,] = await Promise.all([
            prisma_1.default.users.count(),
            prisma_1.default.users.count({ where: { status: 'active' } }),
            prisma_1.default.subscriptions.count({ where: { plan: 'pro', status: 'active' } }),
            prisma_1.default.licenses.count({ where: { status: 'active' } }),
            prisma_1.default.crashReports.count({ where: { status: 'new' } }),
            prisma_1.default.webhookLogs.count({ where: { event: { startsWith: 'feedback.' } } }),
        ]);
        res.json({
            success: true,
            data: {
                totalUsers,
                activeUsers,
                proUsers,
                freeUsers: totalUsers - proUsers,
                activeLicenses,
                crashReports,
                pendingFeedback: feedback,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});
// Users list
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search;
        const where = search ? {
            OR: [
                { email: { contains: search } },
                { username: { contains: search } },
            ],
        } : {};
        const [users, total] = await Promise.all([
            prisma_1.default.users.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    username: true,
                    role: true,
                    status: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.users.count({ where }),
        ]);
        res.json({
            success: true,
            data: users,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});
// Suspend user
router.post('/users/:id/suspend', async (req, res) => {
    try {
        const user = await prisma_1.default.users.update({
            where: { id: req.params.id },
            data: { status: 'suspended' },
        });
        res.json({ success: true, data: user });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to suspend user' });
    }
});
// Unsuspend user
router.post('/users/:id/unsuspend', async (req, res) => {
    try {
        const user = await prisma_1.default.users.update({
            where: { id: req.params.id },
            data: { status: 'active' },
        });
        res.json({ success: true, data: user });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to unsuspend user' });
    }
});
// Licenses
router.get('/licenses', async (req, res) => {
    try {
        const licenses = await prisma_1.default.licenses.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, data: licenses });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch licenses' });
    }
});
// Crash reports
router.get('/crash-reports', async (req, res) => {
    try {
        const reports = await prisma_1.default.crashReports.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, data: reports });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch crash reports' });
    }
});
// Feedback
router.get('/feedback', async (req, res) => {
    try {
        const feedback = await prisma_1.default.webhookLogs.findMany({
            where: { event: { startsWith: 'feedback.' } },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, data: feedback });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch feedback' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.routes.js.map