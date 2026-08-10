"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crashReportController = exports.CrashReportController = void 0;
const crash_report_service_1 = require("../services/crash-report.service");
class CrashReportController {
    async submitCrashReport(req, res, next) {
        try {
            const result = await crash_report_service_1.crashReportService.submitCrashReport(req.user?.userId, req.body);
            res.status(201).json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getCrashReportHistory(req, res, next) {
        try {
            const result = await crash_report_service_1.crashReportService.getCrashReportHistory(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async getCrashReportDetails(req, res, next) {
        try {
            const { id } = req.params;
            const result = await crash_report_service_1.crashReportService.getCrashReportDetails(id);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async updateCrashReportStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const result = await crash_report_service_1.crashReportService.updateCrashReportStatus(id, status);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CrashReportController = CrashReportController;
exports.crashReportController = new CrashReportController();
//# sourceMappingURL=crash-report.controller.js.map