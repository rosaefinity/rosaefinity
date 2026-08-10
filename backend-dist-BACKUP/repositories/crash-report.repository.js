"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.crashReportRepository = exports.CrashReportRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
class CrashReportRepository {
    async create(data) {
        return prisma_1.default.crashReports.create({
            data: {
                userId: data.userId,
                deviceId: data.deviceId,
                appVersion: data.appVersion,
                platform: data.platform,
                stackTrace: data.stackTrace,
                systemInfo: (data.systemInfo || {}),
                status: 'new',
            },
        });
    }
    async findByUserId(userId) {
        return prisma_1.default.crashReports.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    async findById(id) {
        return prisma_1.default.crashReports.findUnique({ where: { id } });
    }
    async updateStatus(id, status) {
        return prisma_1.default.crashReports.update({
            where: { id },
            data: { status: status },
        });
    }
}
exports.CrashReportRepository = CrashReportRepository;
exports.crashReportRepository = new CrashReportRepository();
//# sourceMappingURL=crash-report.repository.js.map