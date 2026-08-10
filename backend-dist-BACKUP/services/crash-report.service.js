"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crashReportService = exports.CrashReportService = void 0;
const crash_report_repository_1 = require("../repositories/crash-report.repository");
class CrashReportService {
    async submitCrashReport(userId, data) {
        const report = await crash_report_repository_1.crashReportRepository.create({
            userId,
            ...data,
        });
        return {
            id: report.id,
            status: report.status,
            message: 'Crash report submitted successfully',
            createdAt: report.createdAt,
        };
    }
    async getCrashReportHistory(userId) {
        const reports = await crash_report_repository_1.crashReportRepository.findByUserId(userId);
        return reports.map((r) => ({
            id: r.id,
            appVersion: r.appVersion,
            platform: r.platform,
            status: r.status,
            createdAt: r.createdAt,
        }));
    }
    async getCrashReportDetails(id) {
        const report = await crash_report_repository_1.crashReportRepository.findById(id);
        if (!report) {
            return null;
        }
        return {
            id: report.id,
            appVersion: report.appVersion,
            platform: report.platform,
            stackTrace: report.stackTrace,
            systemInfo: report.systemInfo,
            status: report.status,
            createdAt: report.createdAt,
        };
    }
    async updateCrashReportStatus(id, status) {
        return crash_report_repository_1.crashReportRepository.updateStatus(id, status);
    }
}
exports.CrashReportService = CrashReportService;
exports.crashReportService = new CrashReportService();
//# sourceMappingURL=crash-report.service.js.map