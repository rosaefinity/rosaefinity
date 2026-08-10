export declare class UpdateService {
    checkForUpdate(currentVersion: string, platform?: string): Promise<{
        currentVersion: string;
        latestVersion: string;
        isUpdateAvailable: boolean;
        isMandatory: boolean;
        downloadUrl: string;
        releaseNotes: string | null;
    }>;
    getLatestVersion(platform?: string): Promise<{
        version: string;
        platform: string;
        downloadUrl: string;
        releaseNotes: string | null;
        isMandatory: boolean;
        createdAt: Date;
    }>;
    getVersionHistory(platform?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: string;
        platform: string;
        downloadUrl: string;
        releaseNotes: string | null;
        isMandatory: boolean;
        isLatest: boolean;
    }[]>;
    private parseVersion;
    private compareVersions;
}
export declare const updateService: UpdateService;
//# sourceMappingURL=update.service.d.ts.map