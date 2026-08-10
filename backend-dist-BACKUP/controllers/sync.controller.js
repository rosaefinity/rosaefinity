"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncController = exports.SyncController = void 0;
const sync_service_1 = require("../services/sync.service");
class SyncController {
    async getSyncMetadata(req, res, next) {
        try {
            const result = await sync_service_1.syncService.getSyncMetadata(req.user.userId);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async pullUpdates(req, res, next) {
        try {
            const { lastSync } = req.query;
            const result = await sync_service_1.syncService.pullUpdates(req.user.userId, lastSync);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async pushUpdates(req, res, next) {
        try {
            const { deviceId, updates } = req.body;
            const result = await sync_service_1.syncService.pushUpdates(req.user.userId, deviceId, updates);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    async resolveConflict(req, res, next) {
        try {
            const { table, recordId, resolution } = req.body;
            const result = await sync_service_1.syncService.resolveConflict(req.user.userId, table, recordId, resolution);
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SyncController = SyncController;
exports.syncController = new SyncController();
//# sourceMappingURL=sync.controller.js.map