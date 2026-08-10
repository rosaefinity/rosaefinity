import { z } from 'zod';
export declare const electronLoginSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        deviceId: z.ZodString;
        deviceName: z.ZodString;
        os: z.ZodString;
        cpu: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        deviceId: string;
        deviceName: string;
        os: string;
        password: string;
        cpu?: string | undefined;
    }, {
        email: string;
        deviceId: string;
        deviceName: string;
        os: string;
        password: string;
        cpu?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
        deviceId: string;
        deviceName: string;
        os: string;
        password: string;
        cpu?: string | undefined;
    };
}, {
    body: {
        email: string;
        deviceId: string;
        deviceName: string;
        os: string;
        password: string;
        cpu?: string | undefined;
    };
}>;
export declare const electronRefreshSchema: z.ZodObject<{
    body: z.ZodObject<{
        refreshToken: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        refreshToken: string;
    }, {
        refreshToken: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        refreshToken: string;
    };
}, {
    body: {
        refreshToken: string;
    };
}>;
export declare const electronValidateSchema: z.ZodObject<{
    body: z.ZodObject<{
        token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        token: string;
    }, {
        token: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        token: string;
    };
}, {
    body: {
        token: string;
    };
}>;
//# sourceMappingURL=electron.validator.d.ts.map