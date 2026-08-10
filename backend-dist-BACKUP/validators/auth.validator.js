"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEmailSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email format'),
        username: zod_1.z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric'),
        password: zod_1.z.string().min(8).max(128),
    }),
});
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(1),
    }),
});
exports.forgotPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email(),
    }),
});
exports.resetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(1),
        password: zod_1.z.string().min(8).max(128),
    }),
});
exports.verifyEmailSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(1),
    }),
});
//# sourceMappingURL=auth.validator.js.map