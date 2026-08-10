export declare class LicenseService {
    activateLicense(userId: string, licenseKey: string, hardwareFingerprint?: string): Promise<{
        licenseKey: string;
        type: import("@prisma/client").$Enums.LicenseTypes;
        status: import("@prisma/client").$Enums.LicenseStatuses;
        activatedAt: Date | null;
        expiredAt: Date | null;
    }>;
    deactivateLicense(userId: string, licenseKey: string): Promise<{
        licenseKey: string;
        status: import("@prisma/client").$Enums.LicenseStatuses;
    }>;
    checkLicense(userId: string): Promise<{
        hasLicense: boolean;
        licenseKey?: undefined;
        type?: undefined;
        status?: undefined;
        activatedAt?: undefined;
        expiredAt?: undefined;
    } | {
        hasLicense: boolean;
        licenseKey: string;
        type: import("@prisma/client").$Enums.LicenseTypes;
        status: import("@prisma/client").$Enums.LicenseStatuses;
        activatedAt: Date | null;
        expiredAt: Date | null;
    }>;
}
export declare const licenseService: LicenseService;
//# sourceMappingURL=license.service.d.ts.map