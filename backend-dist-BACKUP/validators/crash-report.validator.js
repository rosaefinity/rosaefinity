"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitCrashReportSchema = void 0;
const zod_1 = require("zod");
exports.submitCrashReportSchema = zod_1.z.object({
    body: zod_1.z.object({
        appVersion: zod_1.z.string().min(1),
        platform: zod_1.z.string().min(1),
        stackTrace: zod_1.z.string().min(1),
        systemInfo: zod_1.z.record(zod_1.z.unknown()).optional(),
        deviceId: zod_1.z.string().optional(),
    }),
});
//# sourceMappingURL=crash-report.validator.js.map