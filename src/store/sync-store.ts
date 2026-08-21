// =============================================
// RosaeFinity â€” Sync Store (Zustand)
// Global sync state, status, stats, config.
// =============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SyncStatusType, SyncConfig, SyncStats, SyncConflict } from '../services/sync/types';
import { getSyncEngine } from '../services/sync/sync-engine';
import { conflictStore } from '../services/sync/sync-queue';

interface SyncStore {
  // â”€â”€ Status â”€â”€
  status: SyncStatusType;
  isOnline: boolean;
  isInitialized: boolean;

  // â”€â”€ Config â”€â”€
  config: SyncConfig;

  // â”€â”€ Stats â”€â”€
  stats: SyncStats;
  pendingCount: number;
  conflictCount: number;
  conflicts: SyncConflict[];

  // â”€â”€ Actions â”€â”€
  initialize: (userId: string) => Promise<void>;
  sync: () => Promise<void>;
  queueEntity: (entityType: any, entityId: string, operation: any, data: Record<string, unknown>, version: number) => Promise<void>;
  setConfig: (config: Partial<SyncConfig>) => void;
  resolveConflict: (id: number, resolution: 'local' | 'remote' | 'merged', mergedData?: Record<string, unknown>) => Promise<void>;
  retryAll: () => Promise<void>;
  forceSync: () => Promise<void>;
  refreshStats: () => Promise<void>;

  // â”€â”€ Online detection â”€â”€
  setOnline: (online: boolean) => void;

  // â”€â”€ Cleanup â”€â”€
  cleanup: () => void;
}

const DEFAULT_CONFIG: SyncConfig = {
  autoSync: true,
  syncIntervalMs: 5 * 60 * 1000,
  syncOnStartup: true,
  syncOnExit: false,
  maxRetries: 5,
  retryBaseDelayMs: 1000,
  maxRetryDelayMs: 60000,
  batchSize: 50,
  compressionEnabled: false,
};

// â”€â”€ Bound event handlers for cleanup â”€â”€
let handleOnline: (() => void) | null = null;
let handleOffline: (() => void) | null = null;

export const useSyncStore = create<SyncStore>()(
  persist(
    (set, get) => ({
      // â”€â”€ Initial state â”€â”€
      status: 'idle',
      isOnline: navigator.onLine,
      isInitialized: false,
      config: DEFAULT_CONFIG,
      stats: {
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
      },
      pendingCount: 0,
      conflictCount: 0,
      conflicts: [],

      // â”€â”€ Initialize â”€â”€
      initialize: async (userId) => {
        if (get().isInitialized) return;

        try {
          const engine = getSyncEngine(get().config);
          engine.onStatus((status) => {
            set({ status: status as SyncStatusType });
          });

          // Online/offline listeners â€” store refs for cleanup
          handleOnline = () => set({ isOnline: true });
          handleOffline = () => set({ isOnline: false });
          window.addEventListener('online', handleOnline);
          window.addEventListener('offline', handleOffline);

          await engine.initialize(userId);
          set({ isInitialized: true });

          // Refresh stats
          await get().refreshStats();
        } catch (error) {
          console.error('[SyncStore] Initialize failed:', error);
          set({ status: 'error' });
        }
      },

      // â”€â”€ Sync â”€â”€
      sync: async () => {
        try {
          const engine = getSyncEngine();
          await engine.sync();
          await get().refreshStats();
        } catch (error) {
          console.error('[SyncStore] Sync failed:', error);
          set({ status: 'error' });
        }
      },

      // â”€â”€ Queue entity â”€â”€
      queueEntity: async (entityType, entityId, operation, data, version) => {
        try {
          const engine = getSyncEngine();
          await engine.queueEntity(entityType, entityId, operation, data, version);
          set({ status: 'queued' });
          await get().refreshStats();
        } catch (error) {
          console.error('[SyncStore] Queue entity failed:', error);
          set({ status: 'error' });
        }
      },

      // â”€â”€ Config â”€â”€
      setConfig: (config) => {
        const newConfig = { ...get().config, ...config };
        set({ config: newConfig });
        try {
          const engine = getSyncEngine();
          engine.updateConfig(newConfig);
        } catch (error) {
          console.error('[SyncStore] Update config failed:', error);
        }
      },

      // â”€â”€ Conflicts â”€â”€
      resolveConflict: async (id, resolution, mergedData) => {
        try {
          const engine = getSyncEngine();
          await engine.resolveConflict(id, resolution, mergedData);
          await get().refreshStats();
        } catch (error) {
          console.error('[SyncStore] Resolve conflict failed:', error);
        }
      },

      // â”€â”€ Retry all â”€â”€
      retryAll: async () => {
        try {
          const engine = getSyncEngine();
          await engine.retryAll();
          await get().refreshStats();
        } catch (error) {
          console.error('[SyncStore] Retry all failed:', error);
        }
      },

      // â”€â”€ Force sync â”€â”€
      forceSync: async () => {
        set({ status: 'syncing' });
        try {
          const engine = getSyncEngine();
          await engine.sync();
          await get().refreshStats();
        } catch (error) {
          console.error('[SyncStore] Force sync failed:', error);
          set({ status: 'error' });
        }
      },

      // â”€â”€ Refresh stats â”€â”€
      refreshStats: async () => {
        try {
          const engine = getSyncEngine();
          const stats = engine.getStats();
          const pending = await engine.getPendingCount();
          const conflicts = await engine.getConflicts();
          const conflictStats = await conflictStore.getStats();

          set({
            stats,
            pendingCount: pending,
            conflictCount: conflictStats.unresolved,
            conflicts,
          });
        } catch (error) {
          console.error('[SyncStore] Refresh stats failed:', error);
        }
      },

      // â”€â”€ Online â”€â”€
      setOnline: (online) => set({ isOnline: online }),

      // â”€â”€ Cleanup â”€â”€
      cleanup: () => {
        if (handleOnline) window.removeEventListener('online', handleOnline);
        if (handleOffline) window.removeEventListener('offline', handleOffline);
        handleOnline = null;
        handleOffline = null;
      },
    }),
    {
      name: 'rf-sync-store',
      partialize: (state) => ({
        config: state.config,
      }),
    }
  )
);
