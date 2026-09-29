// =============================================
// RosaeFinity — Profile Sync Queue
// Persistent IndexedDB-backed queue for profile CRUD operations.
// Survives offline, app close, app restart.
// =============================================

import Dexie from 'dexie';

// ── Types ──

export type ProfileSyncOperation = 'create' | 'update' | 'delete';
export type ProfileSyncStatus = 'pending' | 'processing' | 'failed' | 'done';

export interface ProfileSyncItem {
  id: string;                    // Queue item ID
  userId: string;                // Account owner (immutable after enqueue)
  operation: ProfileSyncOperation;
  localId: string;               // Local profile ID (spf_xxx or server UUID)
  serverId?: string;             // Backend UUID (set after first successful create)
  payload?: Record<string, unknown>; // Profile data (no media blobs)
  status: ProfileSyncStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  lastError?: string;
  errorCode?: string;            // HTTP status or error classification
  createdAt: number;
  updatedAt: number;
}

// ── Database ──

class ProfileSyncDB extends Dexie {
  queue!: Dexie.Table<ProfileSyncItem, string>;

  constructor() {
    super('RosaeFinityProfileSync');
    this.version(1).stores({
      queue: 'id, userId, operation, status, localId, serverId, nextRetryAt, createdAt',
    });
  }
}

const db = new ProfileSyncDB();

// ── Exponential backoff config ──

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 60_000;
const MAX_ATTEMPTS = 10;
const JITTER_FACTOR = 0.1;

function computeBackoff(attempts: number): number {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS);
  const jitter = delay * JITTER_FACTOR * Math.random();
  return Math.floor(delay + jitter);
}

// ── Queue ──

export class ProfileSyncQueue {
  /**
   * Enqueue a profile operation with deduplication and ordering.
   * - create: deduplicates by localId (updates existing create)
   * - update: merges into pending create/update, or adds new update
   * - delete: removes pending create (never synced), or adds delete
   */
  async enqueue(
    userId: string,
    operation: ProfileSyncOperation,
    localId: string,
    serverId: string | undefined,
    payload?: Record<string, unknown>,
  ): Promise<string> {
    const now = Date.now();

    // ── CREATE dedup ──
    if (operation === 'create') {
      const existing = await db.queue
        .where('userId').equals(userId)
        .and(item => item.localId === localId && item.operation === 'create')
        .first();

      if (existing) {
        await db.queue.update(existing.id, {
          payload: payload ?? existing.payload,
          serverId: serverId ?? existing.serverId,
          status: 'pending',
          attempts: 0,
          nextRetryAt: now,
          updatedAt: now,
        });
        return existing.id;
      }
    }

    // ── UPDATE dedup / merge ──
    if (operation === 'update') {
      // Check if there's a pending create for this localId (never synced yet)
      const pendingCreate = await db.queue
        .where('userId').equals(userId)
        .and(item => item.localId === localId && item.operation === 'create' && item.status !== 'done')
        .first();

      if (pendingCreate) {
        // Merge update into the pending create — no need for separate update
        await db.queue.update(pendingCreate.id, {
          payload: { ...pendingCreate.payload, ...payload },
          updatedAt: now,
        });
        return pendingCreate.id;
      }

      // Check if there's a pending update for this localId
      const pendingUpdate = await db.queue
        .where('userId').equals(userId)
        .and(item => item.localId === localId && item.operation === 'update' && item.status !== 'done')
        .first();

      if (pendingUpdate) {
        // Merge into existing update
        await db.queue.update(pendingUpdate.id, {
          payload: { ...pendingUpdate.payload, ...payload },
          serverId: serverId ?? pendingUpdate.serverId,
          updatedAt: now,
        });
        return pendingUpdate.id;
      }
    }

    // ── DELETE dedup ──
    if (operation === 'delete') {
      // If there's a pending create that was never synced, just remove it
      const pendingCreate = await db.queue
        .where('userId').equals(userId)
        .and(item => item.localId === localId && item.operation === 'create' && item.status !== 'done')
        .first();

      if (pendingCreate) {
        await db.queue.delete(pendingCreate.id);
        return pendingCreate.id;
      }

      // If there's a pending update, remove it (no point updating something about to be deleted)
      const pendingUpdate = await db.queue
        .where('userId').equals(userId)
        .and(item => item.localId === localId && item.operation === 'update' && item.status !== 'done')
        .first();

      if (pendingUpdate) {
        await db.queue.delete(pendingUpdate.id);
      }
    }

    // ── Insert new queue item ──
    const id = `pq_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const item: ProfileSyncItem = {
      id,
      userId,
      operation,
      localId,
      serverId,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await db.queue.add(item);
    return id;
  }

  /** Get items ready for processing (pending and past nextRetryAt). */
  async getReadyItems(userId: string, limit = 5): Promise<ProfileSyncItem[]> {
    const now = Date.now();
    return db.queue
      .where('userId').equals(userId)
      .and(item =>
        item.status === 'pending' &&
        item.nextRetryAt <= now &&
        item.attempts < item.maxAttempts
      )
      .sortBy('createdAt'); // Preserve ordering
  }

  /** Mark item as successfully synced. */
  async markDone(id: string): Promise<void> {
    await db.queue.delete(id);
  }

  /** Mark item as failed with error info. Schedule retry or permanent failure. */
  async markFailed(id: string, error: string, errorCode?: string): Promise<void> {
    const item = await db.queue.get(id);
    if (!item) return;

    const now = Date.now();
    const isPermanent = errorCode
      ? (parseInt(errorCode) >= 400 && parseInt(errorCode) < 500 && parseInt(errorCode) !== 401)
      : false;

    if (isPermanent || item.attempts + 1 >= item.maxAttempts) {
      // Permanent failure or max attempts exhausted
      await db.queue.update(id, {
        status: 'failed',
        attempts: item.attempts + 1,
        lastError: error,
        errorCode,
        updatedAt: now,
      });
    } else {
      // Transient failure — schedule retry with backoff
      const backoff = computeBackoff(item.attempts);
      await db.queue.update(id, {
        status: 'pending',
        attempts: item.attempts + 1,
        lastError: error,
        errorCode,
        nextRetryAt: now + backoff,
        updatedAt: now,
      });
    }
  }

  /** Mark item as currently being processed. */
  async markProcessing(id: string): Promise<void> {
    await db.queue.update(id, { status: 'processing', updatedAt: Date.now() });
  }

  /** Reset all failed items back to pending for retry. */
  async retryAll(userId: string): Promise<number> {
    const now = Date.now();
    const items = await db.queue
      .where('userId').equals(userId)
      .and(item => item.status === 'failed')
      .toArray();

    for (const item of items) {
      await db.queue.update(item.id, {
        status: 'pending',
        attempts: 0,
        nextRetryAt: now,
        updatedAt: now,
      });
    }
    return items.length;
  }

  /** Check if a localId has any pending (non-done) operations. */
  async hasPending(userId: string, localId: string): Promise<boolean> {
    const count = await db.queue
      .where('userId').equals(userId)
      .and(item => item.localId === localId && item.status !== 'done')
      .count();
    return count > 0;
  }

  /** Get all pending items for a user (for checking before pull). */
  async getPendingLocalIds(userId: string): Promise<Set<string>> {
    const items = await db.queue
      .where('userId').equals(userId)
      .and(item => item.status === 'pending' || item.status === 'processing')
      .toArray();
    return new Set(items.map(item => item.localId));
  }

  /** Get queue stats for a user. */
  async getStats(userId: string): Promise<{
    pending: number;
    processing: number;
    failed: number;
  }> {
    const items = await db.queue.where('userId').equals(userId).toArray();
    return {
      pending: items.filter(i => i.status === 'pending').length,
      processing: items.filter(i => i.status === 'processing').length,
      failed: items.filter(i => i.status === 'failed').length,
    };
  }

  /** Clear all queue items for a user (on logout). */
  async clearForUser(userId: string): Promise<void> {
    const items = await db.queue.where('userId').equals(userId).toArray();
    await db.queue.bulkDelete(items.map(i => i.id));
  }

  /** Get all items for a user (for debugging). */
  async getAll(userId: string): Promise<ProfileSyncItem[]> {
    return db.queue.where('userId').equals(userId).toArray();
  }
}

export const profileSyncQueue = new ProfileSyncQueue();
