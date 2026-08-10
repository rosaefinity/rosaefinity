import { Prisma } from '@prisma/client';
export declare class LicenseRepository {
    findByKey(licenseKey: string): Promise<{
        type: import("@prisma/client").$Enums.LicenseTypes;
        status: import("@prisma/client").$Enums.LicenseStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        userId: string | null;
        licenseKey: string;
        activatedAt: Date | null;
        expiredAt: Date | null;
        hardwareFingerprint: string | null;
    } | null>;
    findByUserId(userId: string): Promise<{
        type: import("@prisma/client").$Enums.LicenseTypes;
        status: import("@prisma/client").$Enums.LicenseStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        userId: string | null;
        licenseKey: string;
        activatedAt: Date | null;
        expiredAt: Date | null;
        hardwareFingerprint: string | null;
    } | null>;
    create(data: Prisma.LicensesCreateInput): Promise<{
        type: import("@prisma/client").$Enums.LicenseTypes;
        status: import("@prisma/client").$Enums.LicenseStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        userId: string | null;
        licenseKey: string;
        activatedAt: Date | null;
        expiredAt: Date | null;
        hardwareFingerprint: string | null;
    }>;
    update(id: string, data: Prisma.LicensesUpdateInput): Promise<{
        type: import("@prisma/client").$Enums.LicenseTypes;
        status: import("@prisma/client").$Enums.LicenseStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        userId: string | null;
        licenseKey: string;
        activatedAt: Date | null;
        expiredAt: Date | null;
        hardwareFingerprint: string | null;
    }>;
    createActivationHistory(data: Prisma.ActivationHistoryCreateInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        deviceId: string | null;
        userId: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        hardwareFingerprint: string | null;
        action: import("@prisma/client").$Enums.ActivationActions;
        licenseId: string;
    }>;
}
export declare const licenseRepository: LicenseRepository;
//# sourceMappingURL=license.repository.d.ts.map