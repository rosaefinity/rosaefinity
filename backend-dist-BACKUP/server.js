"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const prisma_1 = __importDefault(require("./config/prisma"));
const logger_1 = __importDefault(require("./utils/logger"));
const start = async () => {
    try {
        // Connect to database
        await prisma_1.default.$connect();
        logger_1.default.info('✅ Database connected');
        // Start server
        const port = parseInt(env_1.env.PORT, 10);
        app_1.default.listen(port, () => {
            logger_1.default.info(`🚀 Server running on port ${port}`);
            logger_1.default.info(`📚 Swagger docs: http://localhost:${port}/api/docs`);
            logger_1.default.info(`🏥 Health check: http://localhost:${port}/api/health`);
        });
    }
    catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger_1.default.error({ err }, '❌ Failed to start server');
        process.exit(1);
    }
};
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_1.default.info('SIGTERM received, shutting down gracefully');
    await prisma_1.default.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_1.default.info('SIGINT received, shutting down gracefully');
    await prisma_1.default.$disconnect();
    process.exit(0);
});
start();
//# sourceMappingURL=server.js.map