"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccountSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
exports.updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        username: zod_1.z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
        avatar: zod_1.z.string().url().optional(),
    }),
});
exports.deleteAccountSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().min(1),
        confirmation: zod_1.z.literal('DELETE'),
    }),
});
//# sourceMappingURL=user.validator.js.map