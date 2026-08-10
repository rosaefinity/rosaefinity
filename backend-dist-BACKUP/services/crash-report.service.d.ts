import { CrashReportData } from '../repositories/crash-report.repository';
export declare class CrashReportService {
    submitCrashReport(userId: string | undefined, data: Omit<CrashReportData, 'userId'>): Promise<{
        id: string;
        status: import("@prisma/client").$Enums.CrashReportStatuses;
        message: string;
        createdAt: Date;
    }>;
    getCrashReportHistory(userId: string): Promise<{
        id: string;
        appVersion: string;
        platform: string;
        status: import("@prisma/client").$Enums.CrashReportStatuses;
        createdAt: Date;
    }[]>;
    getCrashReportDetails(id: string): Promise<{
        id: string;
        appVersion: string;
        platform: string;
        stackTrace: string;
        systemInfo: import("@prisma/client/runtime/library").JsonValue;
        status: import("@prisma/client").$Enums.CrashReportStatuses;
        createdAt: Date;
    } | null>;
    updateCrashReportStatus(id: string, status: string): Promise<{
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
        systemInfo: import("@prisma/client/runtime/library").JsonValue | null;
        resolvedAt: Date | null;
        resolvedBy: string | null;
    }>;
}
export declare const crashReportService: CrashReportService;
//# sourceMappingURL=crash-report.service.d.ts.map