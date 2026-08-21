// =============================================
// RosaeFinity — Sync Service Types
// =============================================

export type SyncEntityType = string;

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncStatusType = 'idle' | 'syncing' | 'queued' | 'error' | 'offline';

export interface SyncEntity {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  data: Record<string, unknown>;
  version: number;
  updatedAt: number;
  deletedAt: number | null;
  checksum: string;
  deviceId: string;
  userId: string;
  syncStatus: string;
}

export interface SyncConfig {
  autoSync: boolean;
  syncIntervalMs: number;
  syncOnStartup: boolean;
  syncOnExit: boolean;
  maxRetries: number;
  retryBaseDelayMs: number;
  maxRetryDelayMs: number;
  batchSize: number;
  compressionEnabled: boolean;
}

export interface SyncStats {
  pendingCount: number;
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  lastSyncAt: number | null;
  lastSyncDuration: number | null;
  lastSyncSpeed: number | null;
  apiLatency: number | null;
  uploadSize: number;
  downloadSize: number;
  retryCount: number;
}

export interface SyncConflict {
  id: number;
  entityType: string;
  entityId: string;
  detectedAt: number;
  resolved: boolean;
  resolution?: string;
  mergedData?: Record<string, unknown>;
}

export interface SyncQueueItem {
  id: number;
  entity: SyncEntity;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  createdAt: number;
  lastError: string | null;
  priority: number;
}

export interface SyncPushPayload {
  records: Array<{
    entityType: SyncEntityType;
    entityId: string;
    operation: SyncOperation;
    data: Record<string, unknown>;
    version: number;
    checksum: string;
    updatedAt: number;
  }>;
  clientVersion: number;
}

export interface SyncPushResult {
  accepted: Array<{ entityType: string; entityId: string }>;
  rejected: Array<{ entityType: string; entityId: string; reason: string }>;
  serverVersion: number;
}

export interface SyncPullResult {
  records: SyncEntity[];
  serverVersion: number;
}
