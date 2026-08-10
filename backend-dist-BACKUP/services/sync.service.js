"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncService = exports.SyncService = void 0;
const sync_repository_1 = require("../repositories/sync.repository");
class SyncService {
    async getSyncMetadata(userId) {
        return sync_repository_1.syncRepository.getSyncMetadata(userId);
    }
    async pullUpdates(userId, lastSync) {
        const lastSyncDate = lastSync ? new Date(lastSync) : undefined;
        return sync_repository_1.syncRepository.pullUpdates(userId, lastSyncDate);
    }
    async pushUpdates(userId, deviceId, updates) {
        const results = {};
        for (const [table, records] of Object.entries(updates)) {
            let synced = 0;
            let conflicts = 0;
            for (const record of records) {
                try {
                    synced++;
                }
                catch {
                    conflicts++;
                }
            }
            results[table] = { synced, conflicts };
        }
        return {
            results,
            timestamp: new Date().toISOString(),
        };
    }
    async resolveConflict(userId, table, recordId, resolution) {
        return {
            table,
            recordId,
            resolution,
            resolvedAt: new Date().toISOString(),
        };
    }
}
exports.SyncService = SyncService;
exports.syncService = new SyncService();
//# sourceMappingURL=sync.service.js.map