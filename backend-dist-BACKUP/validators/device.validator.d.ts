import { z } from 'zod';
export declare const registerDeviceSchema: z.ZodObject<{
    body: z.ZodObject<{
        deviceId: z.ZodString;
        deviceName: z.ZodString;
        os: z.ZodString;
        cpu: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        deviceId: string;
        deviceName: string;
        os: string;
        cpu?: string | undefined;
    }, {
        deviceId: string;
        deviceName: string;
        os: string;
        cpu?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        deviceId: string;
        deviceName: string;
        os: string;
        cpu?: string | undefined;
    };
}, {
    body: {
        deviceId: string;
        deviceName: string;
        os: string;
        cpu?: string | undefined;
    };
}>;
export declare const removeDeviceSchema: z.ZodObject<{
    params: z.ZodObject<{
        deviceId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        deviceId: string;
    }, {
        deviceId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        deviceId: string;
    };
}, {
    params: {
        deviceId: string;
    };
}>;
//# sourceMappingURL=device.validator.d.ts.map