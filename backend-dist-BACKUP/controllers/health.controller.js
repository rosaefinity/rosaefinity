"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthController = exports.HealthController = void 0;
const env_1 = require("../config/env");
const prisma_1 = __importDefault(require("../config/prisma"));
class HealthController {
    async health(_req, res) {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    }
    async version(_req, res) {
        res.json({
            version: '1.0.0',
            nodeVersion: process.version,
            environment: env_1.env.NODE_ENV,
            timestamp: new Date().toISOString(),
        });
    }
    async status(_req, res) {
        let dbStatus = 'unknown';
        try {
            await prisma_1.default.$queryRaw `SELECT 1`;
            dbStatus = 'operational';
        }
        catch {
            dbStatus = 'down';
        }
        res.json({
            status: 'operational',
            services: {
                database: dbStatus,
                api: 'operational',
            },
            timestamp: new Date().toISOString(),
        });
    }
}
exports.HealthController = HealthController;
exports.healthController = new HealthController();
//# sourceMappingURL=health.controller.js.map