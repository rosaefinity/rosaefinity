import { z } from 'zod';
export declare const upgradeSchema: z.ZodObject<{
    body: z.ZodObject<{
        plan: z.ZodEnum<["pro", "business"]>;
    }, "strip", z.ZodTypeAny, {
        plan: "business" | "pro";
    }, {
        plan: "business" | "pro";
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        plan: "business" | "pro";
    };
}, {
    body: {
        plan: "business" | "pro";
    };
}>;
export declare const cancelSchema: z.ZodObject<{
    body: z.ZodObject<{
        reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reason?: string | undefined;
    }, {
        reason?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        reason?: string | undefined;
    };
}, {
    body: {
        reason?: string | undefined;
    };
}>;
//# sourceMappingURL=subscription.validator.d.ts.map