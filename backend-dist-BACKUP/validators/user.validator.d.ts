import { z } from 'zod';
export declare const updateProfileSchema: z.ZodObject<{
    body: z.ZodObject<{
        username: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        username?: string | undefined;
        avatar?: string | undefined;
    }, {
        username?: string | undefined;
        avatar?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        username?: string | undefined;
        avatar?: string | undefined;
    };
}, {
    body: {
        username?: string | undefined;
        avatar?: string | undefined;
    };
}>;
export declare const deleteAccountSchema: z.ZodObject<{
    body: z.ZodObject<{
        password: z.ZodString;
        confirmation: z.ZodLiteral<"DELETE">;
    }, "strip", z.ZodTypeAny, {
        password: string;
        confirmation: "DELETE";
    }, {
        password: string;
        confirmation: "DELETE";
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        password: string;
        confirmation: "DELETE";
    };
}, {
    body: {
        password: string;
        confirmation: "DELETE";
    };
}>;
//# sourceMappingURL=user.validator.d.ts.map