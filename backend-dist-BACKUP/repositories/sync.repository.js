"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncRepository = exports.SyncRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
class SyncRepository {
    async getSyncableData(userId, table, since) {
        const where = { userId };
        if (since) {
            where.updatedAt = { gte: since };
        }
        switch (table) {
            case 'overlayScenes':
                return prisma_1.default.overlayScenes.findMany({ where, orderBy: { updatedAt: 'desc' } });
            case 'overlayInstances':
                return prisma_1.default.overlayInstances.findMany({ where, orderBy: { updatedAt: 'desc' } });
            case 'overlaySettings':
                return prisma_1.default.overlaySettings.findMany({ where, orderBy: { updatedAt: 'desc' } });
            case 'actionGroups':
                return prisma_1.default.actionGroups.findMany({ where, orderBy: { updatedAt: 'desc' } });
            case 'actions':
                return prisma_1.default.actions.findMany({ where, orderBy: { updatedAt: 'desc' } });
            case 'goals':
                return prisma_1.default.goals.findMany({ where, orderBy: { updatedAt: 'desc' } });
            case 'browserSources':
                return prisma_1.default.browserSources.findMany({ where, orderBy: { updatedAt: 'desc' } });
            case 'userSettings':
                return prisma_1.default.userSettings.findMany({ where, orderBy: { updatedAt: 'desc' } });
            default:
                return [];
        }
    }
    async getSyncMetadata(userId) {
        const tables = [
            'overlayScenes',
            'overlayInstances',
            'overlaySettings',
            'actionGroups',
            'actions',
            'goals',
            'browserSources',
            'userSettings',
        ];
        const metadata = {};
        for (const table of tables) {
            const data = await this.getSyncableData(userId, table);
            if (data.length > 0) {
                metadata[table] = data[0].updatedAt;
            }
        }
        return metadata;
    }
    async pullUpdates(userId, lastSync) {
        const tables = [
            'overlayScenes',
            'overlayInstances',
            'overlaySettings',
            'actionGroups',
            'actions',
            'goals',
            'browserSources',
            'userSettings',
        ];
        const updates = {};
        for (const table of tables) {
            updates[table] = await this.getSyncableData(userId, table, lastSync);
        }
        return updates;
    }
}
exports.SyncRepository = SyncRepository;
exports.syncRepository = new SyncRepository();
//# sourceMappingURL=sync.repository.js.map