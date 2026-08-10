"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFeedbackSchema = void 0;
const zod_1 = require("zod");
exports.sendFeedbackSchema = zod_1.z.object({
    body: zod_1.z.object({
        type: zod_1.z.enum(['feedback', 'bug', 'feature']),
        subject: zod_1.z.string().min(1).max(200),
        message: zod_1.z.string().min(10).max(5000),
        email: zod_1.z.string().email().optional(),
        appVersion: zod_1.z.string().optional(),
        platform: zod_1.z.string().optional(),
    }),
});
//# sourceMappingURL=feedback.validator.js.map