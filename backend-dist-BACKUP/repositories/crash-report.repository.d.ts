import { Prisma } from '@prisma/client';
export interface CrashReportData {
    userId?: string;
    deviceId?: string;
    appVersion: string;
    platform: string;
    stackTrace: string;
    systemInfo?: Record<string, unknown>;
}
export declare class CrashReportRepository {
    create(data: CrashReportData): Promise<{
        status: import("@prisma/client").$Enums.CrashReportStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        deviceId: string | null;
        userId: string | null;
        appVersion: string;
        platform: string;
        stackTrace: string;
        systemInfo: Prisma.JsonValue | null;
        resolvedAt: Date | null;
        resolvedBy: string | null;
    }>;
    findByUserId(userId: string): Promise<{
        status: import("@prisma/client").$Enums.CrashReportStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        deviceId: string | null;
        userId: string | null;
        appVersion: string;
        platform: string;
        stackTrace: string;
        systemInfo: Prisma.JsonValue | null;
        resolvedAt: Date | null;
        resolvedBy: string | null;
    }[]>;
    findById(id: string): Promise<{
        status: import("@prisma/client").$Enums.CrashReportStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        deviceId: string | null;
        userId: string | null;
        appVersion: string;
        platform: string;
        stackTrace: string;
        systemInfo: Prisma.JsonValue | null;
        resolvedAt: Date | null;
        resolvedBy: string | null;
    } | null>;
    updateStatus(id: string, status: string): Promise<{
        status: import("@prisma/client").$Enums.CrashReportStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        deviceId: string | null;
        userId: string | null;
        appVersion: string;
        platform: string;
        stackTrace: string;
        systemInfo: Prisma.JsonValue | null;
        resolvedAt: Date | null;
        resolvedBy: string | null;
    }>;
}
export declare const crashReportRepository: CrashReportRepository;
//# sourceMappingURL=crash-report.repository.d.ts.map