// =============================================
// RosaeFinity — Profile Sync Processor
// Processes the ProfileSyncQueue: sends queued operations to backend.
// Handles online/offline, retry, and error classification.
// =============================================

import { profileSyncQueue, type ProfileSyncItem } from './profile-sync-queue';
import { createProfile, updateProfile, deleteProfile } from './profile-api';

const PROCESS_INTERVAL_MS = 30_000; // Check queue every 30s
const BATCH_SIZE = 3;

class ProfileSyncProcessor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private currentUserId: string | null = null;

  /** Start the processor for a user. */
  start(userId: string): void {
    this.stop();
    this.currentUserId = userId;

    // Process immediately
    this.process(userId).catch(() => {});

    // Periodic processing
    this.intervalId = setInterval(() => {
      if (navigator.onLine) {
        this.process(userId).catch(() => {});
      }
    }, PROCESS_INTERVAL_MS);

    // Process on reconnect — reset failed items then process
    const handleOnline = () => {
      if (this.currentUserId === userId) {
        profileSyncQueue.retryAll(userId)
          .then(() => this.process(userId))
          .catch(() => {});
      }
    };
    window.addEventListener('online', handleOnline);
    this._onlineHandler = handleOnline;
  }

  private _onlineHandler: (() => void) | null = null;

  /** Stop the processor. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this._onlineHandler) {
      window.removeEventListener('online', this._onlineHandler);
      this._onlineHandler = null;
    }
    this.currentUserId = null;
  }

  /** Process pending items for a user. */
  async process(userId: string): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;
    this.isProcessing = true;

    try {
      const items = await profileSyncQueue.getReadyItems(userId, BATCH_SIZE);
      for (const item of items) {
        await this.processItem(item);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /** Process a single queue item. */
  private async processItem(item: ProfileSyncItem): Promise<void> {
    await profileSyncQueue.markProcessing(item.id);

    try {
      switch (item.operation) {
        case 'create': {
          const result = await createProfile(item.payload as any);
          // Store serverId on the queue item for future updates
          if (result?.id) {
            await profileSyncQueue.markDone(item.id);
            // Emit event so app-store can update local profile with serverId
            window.dispatchEvent(new CustomEvent('rosae:profile-synced', {
              detail: { localId: item.localId, serverId: result.id, operation: 'create' },
            }));
          } else {
            await profileSyncQueue.markDone(item.id);
          }
          break;
        }

        case 'update': {
          if (!item.serverId) {
            // No serverId — can't update. Mark as permanent failure.
            await profileSyncQueue.markFailed(item.id, 'No serverId for update', 'NO_SERVER_ID');
            return;
          }
          await updateProfile(item.serverId, item.payload as any);
          await profileSyncQueue.markDone(item.id);
          break;
        }

        case 'delete': {
          if (!item.serverId) {
            // Never synced — already handled by queue (create removed)
            await profileSyncQueue.markDone(item.id);
            return;
          }
          await deleteProfile(item.serverId);
          await profileSyncQueue.markDone(item.id);
          break;
        }
      }
    } catch (err: any) {
      const error = err?.message || String(err);
      // Classify error
      let errorCode: string | undefined;
      if (err?.status) {
        errorCode = String(err.status);
      } else if (error.includes('Failed to fetch') || error.includes('NetworkError') || error.includes('offline')) {
        errorCode = 'NETWORK';
      }
      await profileSyncQueue.markFailed(item.id, error, errorCode);
    }
  }

  /** Manually trigger processing (e.g., after enqueuing). */
  async trigger(userId: string): Promise<void> {
    if (navigator.onLine) {
      await this.process(userId);
    }
  }
}

export const profileSyncProcessor = new ProfileSyncProcessor();
