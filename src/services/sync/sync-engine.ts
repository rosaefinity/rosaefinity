// =============================================
// RosaeFinity â€” Sync Engine
// Orchestrates queue, API, conflict resolution.
// Never lets pages talk directly to backend.
// =============================================

import { getSyncApiClient, ApiError } from './api-client.js';
import { syncQueue, conflictStore } from './sync-queue.js';
import type {
  SyncEntity, SyncEntityType, SyncConfig, SyncStats,
  SyncOperation, SyncConflict,
} from './types';

// â”€â”€ Default Config â”€â”€
const DEFAULT_CONFIG: SyncConfig = {
  autoSync: true,
  syncIntervalMs: 5 * 60 * 1000, // 5 minutes
  syncOnStartup: true,
  syncOnExit: false,
  maxRetries: 5,
  retryBaseDelayMs: 1000,
  maxRetryDelayMs: 60000,
  batchSize: 50,
  compressionEnabled: false,
};

// â”€â”€ Sync Engine â”€â”€
class SyncEngine {
  private config: SyncConfig;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private lastSyncAt: number | null = null;
  private lastSyncDuration: number | null = null;
  private stats: SyncStats = this.createEmptyStats();
  private onStatusChange: ((status: string) => void) | null = null;
  private deviceId: string;
  private userId: string | null = null;
  private serverVersion = 0;

  constructor(config?: Partial<SyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.deviceId = this.getDeviceId();
    this.loadServerVersion();
  }

  /** Initialize the sync engine */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;

    // Set auth token
    const client = getSyncApiClient();
    // Token would be set from auth store

    // Start periodic sync
    if (this.config.autoSync) {
      this.startPeriodicSync();
    }

    // Initial sync
    if (this.config.syncOnStartup) {
      await this.sync();
    }
  }

  /** Queue an entity for sync */
  async queueEntity(
    entityType: SyncEntityType,
    entityId: string,
    operation: SyncOperation,
    data: Record<string, unknown>,
    version: number,
  ): Promise<void> {
    if (!this.userId) return;

    const entity: SyncEntity = {
      id: `${entityType}:${entityId}`,
      entityType,
      entityId,
      operation,
      data,
      version,
      updatedAt: Date.now(),
      deletedAt: operation === 'delete' ? Date.now() : null,
      checksum: this.computeChecksum(data),
      deviceId: this.deviceId,
      userId: this.userId,
      syncStatus: 'pending',
    };

    await syncQueue.enqueue(entity);
    this.notifyStatusChange('queued');

    // Try immediate sync if online
    if (navigator.onLine && this.config.autoSync) {
      this.sync().catch(() => {});
    }
  }

  /** Perform a full sync cycle */
  async sync(): Promise<{ pushed: number; pulled: number; conflicts: number }> {
    if (this.isSyncing || !navigator.onLine || !this.userId) {
      return { pushed: 0, pulled: 0, conflicts: 0 };
    }

    this.isSyncing = true;
    this.notifyStatusChange('syncing');
    const startTime = Date.now();

    try {
      const client = getSyncApiClient();

      // 1. Push pending changes
      const pushed = await this.pushPending();

      // 2. Pull remote changes
      const { pulled, conflicts } = await this.pullChanges();

      this.serverVersion = await client.getVersion().catch(() => this.serverVersion);
      this.saveServerVersion();

      this.lastSyncAt = Date.now();
      this.lastSyncDuration = Date.now() - startTime;
      this.stats.lastSyncAt = this.lastSyncAt;
      this.stats.lastSyncDuration = this.lastSyncDuration;

      this.notifyStatusChange('idle');
      return { pushed, pulled, conflicts };
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'OFFLINE') {
        this.notifyStatusChange('offline');
      } else {
        this.notifyStatusChange('error');
      }
      return { pushed: 0, pulled: 0, conflicts: 0 };
    } finally {
      this.isSyncing = false;
    }
  }

  /** Push all pending queue items to server */
  private async pushPending(): Promise<number> {
    const client = getSyncApiClient();
    const items = await syncQueue.getReadyItems(this.config.batchSize);
    if (items.length === 0) return 0;

    const payload = {
      records: items.map(item => ({
        entityType: item.entity.entityType,
        entityId: item.entity.entityId,
        operation: item.entity.operation,
        data: item.entity.data,
        version: item.entity.version,
        checksum: item.entity.checksum,
        updatedAt: item.entity.updatedAt,
      })),
      clientVersion: this.serverVersion,
    };

    try {
      const result = await client.push(payload);

      // Mark accepted items as synced
      for (const accepted of result.accepted) {
        const item = items.find(i =>
          i.entity.entityType === accepted.entityType &&
          i.entity.entityId === accepted.entityId
        );
        if (item) {
          await syncQueue.markSynced(item.id);
        }
      }

      // Handle rejected items
      for (const rejected of result.rejected) {
        const item = items.find(i =>
          i.entity.entityType === rejected.entityType &&
          i.entity.entityId === rejected.entityId
        );
        if (item) {
          if (rejected.reason.includes('version')) {
            // Version conflict â€” mark for conflict resolution
            await syncQueue.markFailed(item.id, rejected.reason);
          } else {
            await syncQueue.markFailed(item.id, rejected.reason);
          }
        }
      }

      this.serverVersion = result.serverVersion;
      this.stats.uploadSize += JSON.stringify(payload).length;
      return result.accepted.length;
    } catch (err: any) {
      // Mark all items as failed for retry
      for (const item of items) {
        await syncQueue.markFailed(item.id, err.message);
      }
      throw err;
    }
  }

  /** Pull remote changes and apply locally */
  private async pullChanges(): Promise<{ pulled: number; conflicts: number }> {
    const client = getSyncApiClient();
    const result = await client.pull(undefined, this.serverVersion, this.config.batchSize);

    let conflicts = 0;

    for (const remoteEntity of result.records) {
      const localConflict = await this.applyRemoteEntity(remoteEntity);
      if (localConflict) conflicts++;
    }

    this.stats.downloadSize += JSON.stringify(result.records).length;
    return { pulled: result.records.length, conflicts };
  }

  /** Apply a remote entity locally, returns true if conflict detected */
  private async applyRemoteEntity(remote: SyncEntity): Promise<boolean> {
    // Emit event for stores to handle
    // In a real implementation, this would dispatch to the appropriate store
    const event = new CustomEvent('rosae:sync-apply', {
      detail: {
        entityType: remote.entityType,
        entityId: remote.entityId,
        data: remote.data,
        operation: remote.operation,
        version: remote.version,
        fromRemote: true,
      },
    });
    window.dispatchEvent(event);

    return false; // No conflict detected at engine level
  }

  /** Resolve a conflict */
  async resolveConflict(conflictId: number, resolution: 'local' | 'remote' | 'merged', mergedData?: Record<string, unknown>): Promise<void> {
    await conflictStore.resolve(conflictId, resolution, mergedData);
    const stats = await conflictStore.getStats();
    this.stats.conflictCount = stats.unresolved;
  }

  /** Get current stats */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /** Get pending count */
  async getPendingCount(): Promise<number> {
    return syncQueue.getPendingCount();
  }

  /** Get unresolved conflicts */
  async getConflicts(): Promise<SyncConflict[]> {
    return conflictStore.getUnresolved();
  }

  /** Retry all failed items */
  async retryAll(): Promise<number> {
    return syncQueue.retryAll();
  }

  /** Set status change callback */
  onStatus(callback: (status: string) => void): void {
    this.onStatusChange = callback;
  }

  /** Start periodic sync */
  startPeriodicSync(): void {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      if (navigator.onLine) {
        this.sync().catch(() => {});
      }
    }, this.config.syncIntervalMs);
  }

  /** Stop periodic sync */
  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /** Update config */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.syncIntervalMs) {
      this.stopPeriodicSync();
      if (this.config.autoSync) this.startPeriodicSync();
    }
  }

  /** Get config */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /** Cleanup */
  destroy(): void {
    this.stopPeriodicSync();
  }

  // â”€â”€ Private Helpers â”€â”€

  private notifyStatusChange(status: string): void {
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
    window.dispatchEvent(new CustomEvent('rosae:sync-status', { detail: { status } }));
  }

  private computeChecksum(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  private getDeviceId(): string {
    try {
      const stored = localStorage.getItem('rf-device-id');
      if (stored) return stored;
    } catch {}
    const id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    try { localStorage.setItem('rf-device-id', id); } catch {}
    return id;
  }

  private loadServerVersion(): void {
    try {
      const v = localStorage.getItem('rf-sync-server-version');
      if (v) this.serverVersion = parseInt(v, 10) || 0;
    } catch {}
  }

  private saveServerVersion(): void {
    try {
      localStorage.setItem('rf-sync-server-version', String(this.serverVersion));
    } catch {}
  }

  private createEmptyStats(): SyncStats {
    return {
      pendingCount: 0,
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      lastSyncAt: null,
      lastSyncDuration: null,
      lastSyncSpeed: null,
      apiLatency: null,
      uploadSize: 0,
      downloadSize: 0,
      retryCount: 0,
    };
  }
}

// Singleton
let _engine: SyncEngine | null = null;

export function getSyncEngine(config?: Partial<SyncConfig>): SyncEngine {
  if (!_engine) {
    _engine = new SyncEngine(config);
  }
  return _engine;
}

export function resetSyncEngine(): void {
  if (_engine) {
    _engine.destroy();
    _engine = null;
  }
}
