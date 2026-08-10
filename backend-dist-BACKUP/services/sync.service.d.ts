export declare class SyncService {
    getSyncMetadata(userId: string): Promise<Record<string, Date>>;
    pullUpdates(userId: string, lastSync?: string): Promise<Record<string, unknown[]>>;
    pushUpdates(userId: string, deviceId: string, updates: Record<string, unknown[]>): Promise<{
        results: Record<string, {
            synced: number;
            conflicts: number;
        }>;
        timestamp: string;
    }>;
    resolveConflict(userId: string, table: string, recordId: string, resolution: 'local' | 'remote'): Promise<{
        table: string;
        recordId: string;
        resolution: "local" | "remote";
        resolvedAt: string;
    }>;
}
export declare const syncService: SyncService;
//# sourceMappingURL=sync.service.d.ts.map