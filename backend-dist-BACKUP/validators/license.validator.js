"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivateLicenseSchema = exports.activateLicenseSchema = void 0;
const zod_1 = require("zod");
exports.activateLicenseSchema = zod_1.z.object({
    body: zod_1.z.object({
        licenseKey: zod_1.z.string().min(1),
        hardwareFingerprint: zod_1.z.string().optional(),
    }),
});
exports.deactivateLicenseSchema = zod_1.z.object({
    body: zod_1.z.object({
        licenseKey: zod_1.z.string().min(1),
    }),
});
//# sourceMappingURL=license.validator.js.map