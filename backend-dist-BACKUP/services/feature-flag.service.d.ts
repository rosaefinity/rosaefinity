export interface FeatureFlags {
    cloudSync: boolean;
    proOverlays: boolean;
    advancedAlerts: boolean;
    multiScreen: boolean;
    customThemes: boolean;
    prioritySupport: boolean;
}
export declare class FeatureFlagService {
    getFeaturesForUser(userId: string): Promise<FeatureFlags>;
    getAllFeatures(): Promise<{
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
}
export declare const featureFlagService: FeatureFlagService;
//# sourceMappingURL=feature-flag.service.d.ts.map