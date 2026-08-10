import { z } from 'zod';
export declare const activateLicenseSchema: z.ZodObject<{
    body: z.ZodObject<{
        licenseKey: z.ZodString;
        hardwareFingerprint: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        licenseKey: string;
        hardwareFingerprint?: string | undefined;
    }, {
        licenseKey: string;
        hardwareFingerprint?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        licenseKey: string;
        hardwareFingerprint?: string | undefined;
    };
}, {
    body: {
        licenseKey: string;
        hardwareFingerprint?: string | undefined;
    };
}>;
export declare const deactivateLicenseSchema: z.ZodObject<{
    body: z.ZodObject<{
        licenseKey: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        licenseKey: string;
    }, {
        licenseKey: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        licenseKey: string;
    };
}, {
    body: {
        licenseKey: string;
    };
}>;
//# sourceMappingURL=license.validator.d.ts.map