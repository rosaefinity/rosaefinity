import { z } from 'zod';
export declare const submitCrashReportSchema: z.ZodObject<{
    body: z.ZodObject<{
        appVersion: z.ZodString;
        platform: z.ZodString;
        stackTrace: z.ZodString;
        systemInfo: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        deviceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        appVersion: string;
        platform: string;
        stackTrace: string;
        deviceId?: string | undefined;
        systemInfo?: Record<string, unknown> | undefined;
    }, {
        appVersion: string;
        platform: string;
        stackTrace: string;
        deviceId?: string | undefined;
        systemInfo?: Record<string, unknown> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        appVersion: string;
        platform: string;
        stackTrace: string;
        deviceId?: string | undefined;
        systemInfo?: Record<string, unknown> | undefined;
    };
}, {
    body: {
        appVersion: string;
        platform: string;
        stackTrace: string;
        deviceId?: string | undefined;
        systemInfo?: Record<string, unknown> | undefined;
    };
}>;
//# sourceMappingURL=crash-report.validator.d.ts.map