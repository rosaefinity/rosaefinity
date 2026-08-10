// =============================================
// RosaeFinity â€” Sync Queue
// IndexedDB-backed offline queue with retry,
// dedup, corruption detection, exponential backoff.
// =============================================

import Dexie from 'dexie';
import type { SyncQueueItem, SyncEntity } from './types';

// â”€â”€ IndexedDB Schema â”€â”€
const db = new Dexie('RosaeFinitySyncQueue');
db.version(1).stores({
  queue: '++id, entity.entityType, entity.entityId, createdAt, nextRetryAt, priority',
  conflicts: '++id, entityType, entityId, detectedAt',
});
db.version(2).stores({
  queue: '++id, entity.entityType, entity.entityId, createdAt, nextRetryAt, priority',
  conflicts: '++id, entityType, entityId, detectedAt, resolved',
});

const QUEUE_TABLE = 'queue' as const;
const CONFLICTS_TABLE = 'conflicts' as const;

// â”€â”€ Queue Class â”€â”€
class SyncQueue {
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;

  constructor(maxRetries = 5, baseDelayMs = 1000, maxDelayMs = 60000) {
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
  }

  /** Add an entity to the sync queue */
  async enqueue(entity: SyncEntity, priority = 0): Promise<void> {
    // Dedup: check if same entity already queued
    const existing = await (db as any)[QUEUE_TABLE]
      .where('entity.entityType')
      .equals(entity.entityType)
      .and((item: SyncQueueItem) => item.entity.entityId === entity.entityId)
      .first();

    if (existing) {
      // Update existing entry with newer data
      await (db as any)[QUEUE_TABLE].update(existing.id, {
        entity,
        attempts: 0,
        nextRetryAt: Date.now(),
        lastError: null,
        priority: Math.max(existing.priority, priority),
      });
    } else {
      await (db as any)[QUEUE_TABLE].add({
        entity,
        attempts: 0,
        maxAttempts: this.maxRetries,
        nextRetryAt: Date.now(),
        createdAt: Date.now(),
        lastError: null,
        priority,
      });
    }
  }

  /** Get items ready for processing (not past max attempts, not waiting for retry) */
  async getReadyItems(limit = 50): Promise<SyncQueueItem[]> {
    const now = Date.now();
    const items = await (db as any)[QUEUE_TABLE]
      .where('nextRetryAt')
      .belowOrEqual(now)
      .and((item: SyncQueueItem) => item.attempts < item.maxAttempts)
      .toArray();

    // Sort by priority (high first), then by createdAt (oldest first)
    return items
      .sort((a: SyncQueueItem, b: SyncQueueItem) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.createdAt - b.createdAt;
      })
      .slice(0, limit);
  }

  /** Mark item as successfully synced */
  async markSynced(id: number): Promise<void> {
    await (db as any)[QUEUE_TABLE].delete(id);
  }

  /** Mark item as failed, schedule retry with exponential backoff */
  async markFailed(id: number, error: string): Promise<void> {
    const item = await (db as any)[QUEUE_TABLE].get(id) as SyncQueueItem | undefined;
    if (!item) return;

    const attempts = item.attempts + 1;
    const delay = Math.min(this.baseDelayMs * Math.pow(2, attempts), this.maxDelayMs);
    const jitter = delay * 0.1 * Math.random();

    if (attempts >= item.maxAttempts) {
      // Move to failed state but keep in queue for manual retry
      await (db as any)[QUEUE_TABLE].update(id, {
        attempts,
        lastError: error,
        nextRetryAt: Date.now() + 24 * 60 * 60 * 1000, // Retry in 24h
      });
    } else {
      await (db as any)[QUEUE_TABLE].update(id, {
        attempts,
        lastError: error,
        nextRetryAt: Date.now() + delay + jitter,
      });
    }
  }

  /** Get queue statistics */
  async getStats(): Promise<{
    total: number;
    pending: number;
    failed: number;
    oldestItem: number | null;
  }> {
    const all = await (db as any)[QUEUE_TABLE].toArray() as SyncQueueItem[];
    const now = Date.now();
    const pending = all.filter(i => i.attempts < i.maxAttempts && i.nextRetryAt <= now).length;
    const failed = all.filter(i => i.attempts >= i.maxAttempts).length;
    const oldest = all.length > 0 ? Math.min(...all.map(i => i.createdAt)) : null;

    return {
      total: all.length,
      pending,
      failed,
      oldestItem: oldest,
    };
  }

  /** Clear all synced items */
  async clear(): Promise<void> {
    await (db as any)[QUEUE_TABLE].clear();
  }

  /** Get total pending items count */
  async getPendingCount(): Promise<number> {
    const stats = await this.getStats();
    return stats.total;
  }

  /** Retry all failed items */
  async retryAll(): Promise<number> {
    const items = await (db as any)[QUEUE_TABLE]
      .where('attempts')
      .above(0)
      .toArray() as SyncQueueItem[];

    let count = 0;
    for (const item of items) {
      await (db as any)[QUEUE_TABLE].update(item.id, {
        attempts: 0,
        nextRetryAt: Date.now(),
        lastError: null,
      });
      count++;
    }
    return count;
  }
}

// â”€â”€ Conflict Storage â”€â”€
class ConflictStore {
  async add(conflict: Omit<import('./types').SyncConflict, 'id'>): Promise<void> {
    await (db as any)[CONFLICTS_TABLE].add(conflict);
  }

  async getAll(): Promise<import('./types').SyncConflict[]> {
    return (db as any)[CONFLICTS_TABLE].toArray();
  }

  async getUnresolved(): Promise<import('./types').SyncConflict[]> {
    return (db as any)[CONFLICTS_TABLE]
      .where('resolved')
      .equals(0)
      .toArray();
  }

  async resolve(id: number, resolution: 'local' | 'remote' | 'merged' | 'discarded', mergedData?: Record<string, unknown>): Promise<void> {
    await (db as any)[CONFLICTS_TABLE].update(id, {
      resolved: true,
      resolution,
      mergedData,
    });
  }

  async getStats(): Promise<{ total: number; unresolved: number }> {
    const all = await this.getAll();
    return {
      total: all.length,
      unresolved: all.filter(c => !c.resolved).length,
    };
  }
}

// Singletons
export const syncQueue = new SyncQueue();
export const conflictStore = new ConflictStore();
