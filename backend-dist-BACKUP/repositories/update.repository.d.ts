export declare class UpdateRepository {
    findLatestVersion(platform: string): Promise<{
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
    } | null>;
    findAllVersions(platform: string): Promise<{
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
    createVersion(data: {
        version: string;
        platform: string;
        downloadUrl: string;
        releaseNotes?: string;
        isMandatory?: boolean;
    }): Promise<{
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
    }>;
}
export declare const updateRepository: UpdateRepository;
//# sourceMappingURL=update.repository.d.ts.map