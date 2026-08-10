"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDeviceSchema = exports.registerDeviceSchema = void 0;
const zod_1 = require("zod");
exports.registerDeviceSchema = zod_1.z.object({
    body: zod_1.z.object({
        deviceId: zod_1.z.string().min(1).max(255),
        deviceName: zod_1.z.string().min(1).max(100),
        os: zod_1.z.string().min(1).max(50),
        cpu: zod_1.z.string().max(100).optional(),
    }),
});
exports.removeDeviceSchema = zod_1.z.object({
    params: zod_1.z.object({
        deviceId: zod_1.z.string().min(1),
    }),
});
//# sourceMappingURL=device.validator.js.map