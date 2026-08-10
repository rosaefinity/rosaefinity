export declare class FeatureFlagRepository {
    findAllEnabled(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        name: string;
        description: string | null;
        key: string;
        isEnabled: boolean;
        targeting: import("@prisma/client/runtime/library").JsonValue | null;
        flagType: import("@prisma/client").$Enums.FeatureFlagTypes;
        createdBy: string;
    }[]>;
    findByKey(key: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        name: string;
        description: string | null;
        key: string;
        isEnabled: boolean;
        targeting: import("@prisma/client/runtime/library").JsonValue | null;
        flagType: import("@prisma/client").$Enums.FeatureFlagTypes;
        createdBy: string;
    } | null>;
    create(data: {
        key: string;
        name: string;
        description?: string;
        flagType?: string;
        createdBy: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        name: string;
        description: string | null;
        key: string;
        isEnabled: boolean;
        targeting: import("@prisma/client/runtime/library").JsonValue | null;
        flagType: import("@prisma/client").$Enums.FeatureFlagTypes;
        createdBy: string;
    }>;
    update(key: string, data: {
        isEnabled?: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        name: string;
        description: string | null;
        key: string;
        isEnabled: boolean;
        targeting: import("@prisma/client/runtime/library").JsonValue | null;
        flagType: import("@prisma/client").$Enums.FeatureFlagTypes;
        createdBy: string;
    }>;
}
export declare const featureFlagRepository: FeatureFlagRepository;
//# sourceMappingURL=feature-flag.repository.d.ts.map