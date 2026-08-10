"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelSchema = exports.upgradeSchema = void 0;
const zod_1 = require("zod");
exports.upgradeSchema = zod_1.z.object({
    body: zod_1.z.object({
        plan: zod_1.z.enum(['pro', 'business']),
    }),
});
exports.cancelSchema = zod_1.z.object({
    body: zod_1.z.object({
        reason: zod_1.z.string().max(500).optional(),
    }),
});
//# sourceMappingURL=subscription.validator.js.map