import { z } from 'zod';
export declare const sendFeedbackSchema: z.ZodObject<{
    body: z.ZodObject<{
        type: z.ZodEnum<["feedback", "bug", "feature"]>;
        subject: z.ZodString;
        message: z.ZodString;
        email: z.ZodOptional<z.ZodString>;
        appVersion: z.ZodOptional<z.ZodString>;
        platform: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        type: "feedback" | "bug" | "feature";
        subject: string;
        email?: string | undefined;
        appVersion?: string | undefined;
        platform?: string | undefined;
    }, {
        message: string;
        type: "feedback" | "bug" | "feature";
        subject: string;
        email?: string | undefined;
        appVersion?: string | undefined;
        platform?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        message: string;
        type: "feedback" | "bug" | "feature";
        subject: string;
        email?: string | undefined;
        appVersion?: string | undefined;
        platform?: string | undefined;
    };
}, {
    body: {
        message: string;
        type: "feedback" | "bug" | "feature";
        subject: string;
        email?: string | undefined;
        appVersion?: string | undefined;
        platform?: string | undefined;
    };
}>;
//# sourceMappingURL=feedback.validator.d.ts.map