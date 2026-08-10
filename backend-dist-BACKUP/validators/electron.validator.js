"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.electronValidateSchema = exports.electronRefreshSchema = exports.electronLoginSchema = void 0;
const zod_1 = require("zod");
exports.electronLoginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(1),
        deviceId: zod_1.z.string().min(1),
        deviceName: zod_1.z.string().min(1).max(100),
        os: zod_1.z.string().min(1).max(50),
        cpu: zod_1.z.string().max(100).optional(),
    }),
});
exports.electronRefreshSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().min(1),
    }),
});
exports.electronValidateSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(1),
    }),
});
//# sourceMappingURL=electron.validator.js.map