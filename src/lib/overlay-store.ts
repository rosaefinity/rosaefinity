import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OverlayInstance } from '../overlays/types';
import { resolveConfig } from '../overlays/createConfig';
import { defaultGoalProgressConfig } from '../overlays/goal-progress/types';
import type { GoalProgressConfig } from '../overlays/goal-progress/types';
import { sendToOverlay } from './overlay-bus';
import {
  saveOverlayInstance,
  getAllOverlayInstances,
  deleteOverlayInstanceFromDB,
} from './db';
import { authStore } from '../store/auth-store';
import { appStore } from '../store/app-store';

// ─── BrowserSourceId UUID format check ───
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Remote sync flag ───
// Prevents remote-originated writes from re-enqueuing for sync
let _applyingRemote = false;
export function isApplyingRemote(): boolean { return _applyingRemote; }
export function setApplyingRemote(v: boolean): void { _applyingRemote = v; }

// ─── Ownership helpers ───
function getCurrentUserId(): string | undefined {
  return authStore.getState().currentUser?.id;
}

function getCurrentProfileId(): string | undefined {
  return appStore.getState().currentProfileId;
}

/** Check that an overlay belongs to the current user and profile */
function assertOwnership(instance: OverlayInstance): boolean {
  const userId = getCurrentUserId();
  const profileId = getCurrentProfileId();

  // Capture transition state ONCE at start
  const transitioning = isProfileTransitioning();
  const targetProfileId = getTargetProfileId();

  // Diagnostic: compute mismatch flags
  const userMismatch = Boolean(instance.userId && instance.userId !== userId);
  const transitionMismatch = Boolean(
    transitioning && (!targetProfileId || instance.profileId !== targetProfileId)
  );
  const normalProfileMismatch = Boolean(
    !transitioning && instance.profileId && instance.profileId !== profileId
  );

  // Determine which branch would return false
  let falseBranch: "USER" | "TRANSITION" | "NORMAL" = "NORMAL";
  if (userMismatch) falseBranch = "USER";
  else if (transitioning && (!targetProfileId || instance.profileId !== targetProfileId)) falseBranch = "TRANSITION";
  else if (!transitioning && instance.profileId && instance.profileId !== profileId) falseBranch = "NORMAL";

  // Account ownership MUST always be enforced
  if (instance.userId && instance.userId !== userId) return false;

  // During profile transition, allow updates to instances belonging to the TARGET profile
  if (transitioning) {
    if (targetProfileId && instance.profileId === targetProfileId) {
      return true;
    }
    // During transition, reject instances that don't match the target profile
    return false;
  }

  // Normal operation: profileId must match current profile
  if (instance.profileId && instance.profileId !== profileId) return false;
  return true;
}

/** Profile transition state to prevent stale instance access during switch */
let _profileTransitioning = false;
let _targetProfileId: string | null = null;

export function isProfileTransitioning(): boolean { return _profileTransitioning; }
export function getTargetProfileId(): string | null { return _targetProfileId; }

// â”€â”€ IPC sync helpers (Electron only) â”€â”€
function syncInstancesToMain(instances: OverlayInstance[]): void {
  try {
    const api = (window as Record<string, unknown>)['electronAPI'] as Record<string, unknown> | undefined;
    if (api?.syncOverlayInstances) {
      (api.syncOverlayInstances as (instances: OverlayInstance[]) => void)(instances);
    }
  } catch (_) {}
}

/**
 * Push instances to the main process immediately after Dexie load.
 * This populates overlayInstancesByBrowserSourceId before Browser Source
 * /config requests can arrive, eliminating the config-fetch retry race.
 */
function pushInstancesToMain(instances: OverlayInstance[]): void {
  try {
    const api = (window as Record<string, unknown>)['electronAPI'] as Record<string, unknown> | undefined;
    if (api?.pushOverlayInstances) {
      (api.pushOverlayInstances as (instances: OverlayInstance[]) => void)(instances);
    }
  } catch (_) {}
}

function notifyInstanceUpdated(instance: OverlayInstance): void {
  try {
    const api = (window as Record<string, unknown>)['electronAPI'] as Record<string, unknown> | undefined;
    if (api?.notifyOverlayUpdated) {
      (api.notifyOverlayUpdated as (instance: OverlayInstance) => void)(instance);
    }
  } catch (_) {}
}

function notifyInstanceDeleted(instanceId: string): void {
  try {
    const api = (window as Record<string, unknown>)['electronAPI'] as Record<string, unknown> | undefined;
    if (api?.notifyOverlayDeleted) {
      (api.notifyOverlayDeleted as (instanceId: string) => void)(instanceId);
    }
  } catch (_) {}
}

interface OverlayStore {
  instances: OverlayInstance[];
  loaded: boolean;
  favoriteIds: Set<string>;

  // Actions
  addInstance: (params: {
    moduleId: string;
    name: string;
    enabled: boolean;
    config: Record<string, unknown>;
    configVersion: number;
  }) => OverlayInstance;
  updateConfig: (id: string, config: Record<string, unknown>) => void;
  toggleEnabled: (id: string) => void;
  removeInstance: (id: string) => void;
  renameInstance: (id: string, name: string) => void;
  toggleFavorite: (moduleId: string) => void;
  duplicateInstance: (id: string) => OverlayInstance | undefined;

  // Selectors
  getInstance: (id: string) => OverlayInstance | undefined;
  getInstanceByBrowserSourceId: (browserSourceId: string) => OverlayInstance | undefined;
  getInstancesByModule: (moduleId: string) => OverlayInstance[];

  // Persistence (now connected to Dexie)
  loadInstances: (userId?: string, profileId?: string) => Promise<void>;
  persistInstance: (instance: OverlayInstance) => Promise<void>;
  deleteInstanceFromDB: (id: string) => Promise<void>;

  // Remote sync (bypasses sync queue — used by SyncEngine pull)
  applyRemoteOverlay: (instance: OverlayInstance) => Promise<void>;
  removeRemoteOverlay: (id: string) => Promise<void>;

  // Migration — assign legacy overlays to current user + profile
  migrateLegacyOverlays: (userId: string, profileId?: string) => Promise<void>;

  // Profile switching — atomic profile transition
  switchProfile: (userId: string, targetProfileId: string) => Promise<void>;
}

export const useOverlayStore = create<OverlayStore>()(
  persist(
    (set, get) => ({
      instances: [],
      loaded: false,
      favoriteIds: new Set<string>(),

      addInstance: (params) => {
        const now = Date.now();
        // Get current userId from auth store for account ownership
        const currentUserId = authStore.getState().currentUser?.id;
        // Get current profileId for profile ownership
        const currentProfileId = appStore.getState().currentProfileId;
        const instance: OverlayInstance = {
          id: crypto.randomUUID(),
          moduleId: params.moduleId,
          name: params.name,
          enabled: params.enabled,
          browserSourceId: crypto.randomUUID(),
          config: params.config,
          configVersion: params.configVersion,
          createdAt: now,
          updatedAt: now,
          userId: currentUserId,
          profileId: currentProfileId,
        };

        set((state) => ({ instances: [...state.instances, instance] }));
        get().persistInstance(instance);

        // Queue create for cloud sync (unless remote-originated)
        if (!_applyingRemote) {
          const syncData = { id: instance.id, moduleId: instance.moduleId, name: instance.name, enabled: instance.enabled, browserSourceId: instance.browserSourceId, config: instance.config, configVersion: instance.configVersion, createdAt: instance.createdAt, updatedAt: instance.updatedAt, userId: instance.userId, profileId: instance.profileId };
          import('../services/sync/sync-engine').then(({ getSyncEngine }) => {
            getSyncEngine().queueEntity('overlay', instance.id, 'create', syncData, 1).catch(() => {});
          }).catch(() => {});
        }

        return instance;
      },

      updateConfig: (id, config) => {
        // Ownership enforcement: only update overlays belonging to current profile
        const target = get().getInstance(id);

        if (target && !assertOwnership(target)) {
          return;
        }

        set((state) => ({
          instances: state.instances.map((inst) =>
            inst.id === id ? { ...inst, config, updatedAt: Date.now() } : inst
          ),
        }));

        const updated = get().getInstance(id);

        if (updated) {
          get().persistInstance(updated);
          // Queue update for cloud sync
          if (!_applyingRemote) {
            const syncData = { id: updated.id, moduleId: updated.moduleId, name: updated.name, enabled: updated.enabled, browserSourceId: updated.browserSourceId, config: updated.config, configVersion: updated.configVersion, createdAt: updated.createdAt, updatedAt: updated.updatedAt, userId: updated.userId, profileId: updated.profileId };
            import('../services/sync/sync-engine').then(({ getSyncEngine }) => {
              getSyncEngine().queueEntity('overlay', id, 'update', syncData, updated.configVersion).catch(() => {});
            }).catch(() => {});
          }
        }
      },

      toggleEnabled: (id) => {
        // Ownership enforcement
        const target = get().getInstance(id);
        if (target && !assertOwnership(target)) return;
        set((state) => ({
          instances: state.instances.map((inst) =>
            inst.id === id ? { ...inst, enabled: !inst.enabled, updatedAt: Date.now() } : inst
          ),
        }));

        const updated = get().getInstance(id);
        if (updated) {
          get().persistInstance(updated);
          // Queue update for cloud sync
          if (!_applyingRemote) {
            const syncData = { id: updated.id, moduleId: updated.moduleId, name: updated.name, enabled: updated.enabled, browserSourceId: updated.browserSourceId, config: updated.config, configVersion: updated.configVersion, createdAt: updated.createdAt, updatedAt: updated.updatedAt, userId: updated.userId, profileId: updated.profileId };
            import('../services/sync/sync-engine').then(({ getSyncEngine }) => {
              getSyncEngine().queueEntity('overlay', id, 'update', syncData, updated.configVersion).catch(() => {});
            }).catch(() => {});
          }
        }
      },

      removeInstance: (id) => {
        // Ownership enforcement
        const target = get().getInstance(id);
        if (target && !assertOwnership(target)) return;
        set((state) => ({
          instances: state.instances.filter((inst) => inst.id !== id),
        }));
        get().deleteInstanceFromDB(id);
        // Queue deletion for cloud sync (unless this is a remote-originated removal)
        if (!_applyingRemote) {
          import('../services/sync/sync-engine').then(({ getSyncEngine }) => {
            getSyncEngine().queueEntity('overlay', id, 'delete', {}, 1).catch(() => {});
          }).catch(() => {});
        }
      },

      renameInstance: (id, name) => {
        // Ownership enforcement
        const target = get().getInstance(id);
        if (target && !assertOwnership(target)) return;
        set((state) => ({
          instances: state.instances.map((inst) =>
            inst.id === id ? { ...inst, name, updatedAt: Date.now() } : inst
          ),
        }));

        const updated = get().getInstance(id);
        if (updated) {
          get().persistInstance(updated);
          // Queue update for cloud sync
          if (!_applyingRemote) {
            const syncData = { id: updated.id, moduleId: updated.moduleId, name: updated.name, enabled: updated.enabled, browserSourceId: updated.browserSourceId, config: updated.config, configVersion: updated.configVersion, createdAt: updated.createdAt, updatedAt: updated.updatedAt, userId: updated.userId, profileId: updated.profileId };
            import('../services/sync/sync-engine').then(({ getSyncEngine }) => {
              getSyncEngine().queueEntity('overlay', id, 'update', syncData, updated.configVersion).catch(() => {});
            }).catch(() => {});
          }
        }
      },

      toggleFavorite: (moduleId) => {
        set((state) => {
          const next = new Set(state.favoriteIds);
          if (next.has(moduleId)) {
            next.delete(moduleId);
          } else {
            next.add(moduleId);
          }
          return { favoriteIds: next };
        });
      },

      duplicateInstance: (id) => {
        const original = get().getInstance(id);
        if (!original) return undefined;
        // Ownership enforcement
        if (!assertOwnership(original)) return undefined;

        // Use current userId + profileId (not original's — duplicate belongs to current profile)
        const currentUserId = getCurrentUserId();
        const currentProfileId = getCurrentProfileId();

        const now = Date.now();
        const duplicate: OverlayInstance = {
          ...original,
          id: crypto.randomUUID(),
          name: `${original.name} (Copy)`,
          browserSourceId: crypto.randomUUID(),
          config: resolveConfig(original.config),
          createdAt: now,
          updatedAt: now,
          userId: currentUserId,
          profileId: currentProfileId,
        };

        set((state) => ({ instances: [...state.instances, duplicate] }));
        get().persistInstance(duplicate);
        return duplicate;
      },

      getInstance: (id) => get().instances.find((inst) => inst.id === id),

      getInstanceByBrowserSourceId: (browserSourceId) =>
        get().instances.find((inst) => inst.browserSourceId === browserSourceId),

      getInstancesByModule: (moduleId) =>
        get().instances.filter((inst) => inst.moduleId === moduleId),

      loadInstances: async (userId?: string, profileId?: string) => {
        try {
          let rawInstances = await getAllOverlayInstances(userId);
          // If profileId supplied, filter to only that profile's overlays
          if (profileId) {
            rawInstances = rawInstances.filter(inst => inst.profileId === profileId);
          }
          // Resolve configs to fill any missing base fields (position, size, etc.)
          let instances = rawInstances.map((inst) => ({
            ...inst,
            config: resolveConfig(inst.config),
          }));

          // ── Backfill non-UUID browserSourceIds (legacy migration) ──
          // Some overlay instances from older code versions stored non-UUID
          // browserSourceId values (e.g. "tmp_nnp9gk9t") that don't match
          // the server regex [a-f0-9-]+. Replace them with valid UUIDs.
          const existingIds = new Set(instances.map(i => i.browserSourceId));
          let migrated = 0;
          instances = instances.map(inst => {
            if (UUID_RE.test(inst.browserSourceId)) return inst;
            // Generate a unique UUID that doesn't collide with any existing ID
            let newId: string;
            do { newId = crypto.randomUUID(); } while (existingIds.has(newId));
            existingIds.add(newId);
            existingIds.delete(inst.browserSourceId);
            migrated++;
            console.log('[OVERLAY-ID-MIGRATION]', inst.browserSourceId, '->', newId);
            return { ...inst, browserSourceId: newId };
          });
          if (migrated > 0) {
            console.log('[OVERLAY-ID-MIGRATION] migrated', migrated, 'overlay instance(s)');
            // Persist the migrated instances to Dexie
            for (const inst of instances) {
              // Only save instances that actually changed (compare against originals)
              const original = rawInstances.find(r => r.id === inst.id);
              if (original && original.browserSourceId !== inst.browserSourceId) {
                await saveOverlayInstance(inst);
              }
            }
          }

          set({ instances, loaded: true });
          // Push to main process immediately — populates the instance map
          // BEFORE Browser Source /config requests can arrive (eliminates race)
          pushInstancesToMain(instances);
          // Also sync via the existing channel for full rebuild
          syncInstancesToMain(instances);
          // Push Goal Progress config to Electron main process for browser sources
          const gpInstance = instances.find(i => i.moduleId === 'goal-progress');
          if (gpInstance) {
            const full = { ...defaultGoalProgressConfig, ...(gpInstance.config as Partial<GoalProgressConfig>) };
            try {
              (window as any).electronAPI?.pushGoalConfig?.(full);
            } catch { /* not in Electron */ }
          }
        } catch (error) {
          console.error('[OverlayStore] Failed to load instances:', error);
          set({ loaded: true, instances: [] });
        }
      },

      persistInstance: async (instance: OverlayInstance) => {
        try {
          await saveOverlayInstance(instance);
          // Sync to main process for SSE config endpoint
          notifyInstanceUpdated(instance);
          // Sync Goal Progress config to localStorage + server + broadcast via SSE
          if (instance.moduleId === 'goal-progress') {
            try {
              const full = { ...defaultGoalProgressConfig, ...(instance.config as Partial<GoalProgressConfig>) };
              localStorage.setItem('rf-goal-config', JSON.stringify(full));
              // Store config on server for newly-connected browser sources
              fetch('http://localhost:18890/goal-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(full),
              }).catch(() => {});
              // Broadcast via SSE so all connected browser sources receive the update
              sendToOverlay({ type: 'goal-config-update', config: full } as any);
            } catch (err) { console.error('[GOAL-SYNC] persistInstance error:', err); }
          }
        } catch (error) {
          console.error('[OverlayStore] Failed to persist instance:', error);
        }
      },

      deleteInstanceFromDB: async (id: string) => {
        try {
          await deleteOverlayInstanceFromDB(id);
          // Sync to main process for SSE config endpoint
          notifyInstanceDeleted(id);
        } catch (error) {
          console.error('[OverlayStore] Failed to delete instance from DB:', error);
        }
      },

      // ── Remote sync methods (bypass sync queue) ──
      applyRemoteOverlay: async (instance: OverlayInstance) => {
        setApplyingRemote(true);
        try {
          // Get current userId for ownership assignment
          let currentUserId: string | undefined;
          try {
            const authModule = require('../store/auth-store');
            currentUserId = authModule?.useAuthStore?.getState?.()?.currentUser?.id;
          } catch {}
          const ownerUserId = instance.userId || currentUserId;

          const existing = get().instances.find(i => i.id === instance.id);
          if (existing) {
            // Update existing: merge remote fields, preserve local browserSourceId + local profileId if set
            const merged: OverlayInstance = {
              ...instance,
              browserSourceId: existing.browserSourceId || instance.browserSourceId,
              config: resolveConfig(instance.config),
              userId: ownerUserId,
              // Preserve remote profileId if present, otherwise keep existing
              profileId: instance.profileId || existing.profileId,
            };
            set((state) => ({
              instances: state.instances.map(i => i.id === merged.id ? merged : i),
            }));
            await saveOverlayInstance(merged);
            notifyInstanceUpdated(merged);
          } else {
            // Create new: use remote IDs exactly, preserve remote profileId
            const resolved: OverlayInstance = {
              ...instance,
              config: resolveConfig(instance.config),
              userId: ownerUserId,
              profileId: instance.profileId, // preserve remote profileId (may be undefined for legacy)
            };
            set((state) => ({ instances: [...state.instances, resolved] }));
            await saveOverlayInstance(resolved);
            notifyInstanceUpdated(resolved);
          }
        } finally {
          setApplyingRemote(false);
        }
      },

      removeRemoteOverlay: async (id: string) => {
        setApplyingRemote(true);
        try {
          set((state) => ({
            instances: state.instances.filter(i => i.id !== id),
          }));
          await deleteOverlayInstanceFromDB(id);
          notifyInstanceDeleted(id);
        } finally {
          setApplyingRemote(false);
        }
      },

      // ── Legacy migration — assign unowned overlays to current user + profile ──
      migrateLegacyOverlays: async (userId: string, profileId?: string) => {
        try {
          const allInstances = await getAllOverlayInstances(userId);
          // Find overlays belonging to this user but without a profileId
          const unprofiled = allInstances.filter(i => i.userId === userId && !i.profileId);
          if (unprofiled.length === 0) return;

          // Only migrate if a valid profileId is provided
          if (!profileId) return;

          console.log('[MIGRATION] Assigning', unprofiled.length, 'legacy overlays to profile', profileId);

          for (const instance of unprofiled) {
            const updated: OverlayInstance = { ...instance, profileId };
            await saveOverlayInstance(updated);
          }

          // Reload in-memory state to reflect migration
          const reloaded = await getAllOverlayInstances(userId);
          const profileInstances = reloaded.filter(i => i.profileId === profileId);
          set({
            instances: profileInstances.map(i => ({ ...i, config: resolveConfig(i.config) })),
          });
        } catch (err) {
          console.error('[OverlayStore] Legacy migration failed:', err);
        }
      },

      // ── Atomic profile switch — clears stale instances BEFORE loading target profile ──
      switchProfile: async (userId: string, targetProfileId: string) => {
        // 1. Immediately clear instances to prevent stale data access during transition
        // This is synchronous and happens before currentProfileId changes in app-store
        _profileTransitioning = true;
        _targetProfileId = targetProfileId;
        set({ instances: [], loaded: false });
        console.log('[OVERLAY-PROFILE-SWITCH] Cleared instances, starting load for profile:', targetProfileId);

        try {
          // 2. Load target profile's instances
          await get().loadInstances(userId, targetProfileId);
          console.log('[OVERLAY-PROFILE-SWITCH] Loaded instances for profile:', targetProfileId);
        } finally {
          // 3. Always clear transition state
          _profileTransitioning = false;
          _targetProfileId = null;
        }
      },
    }),
    {
      name: 'rf-overlay-favorites',
      // Only persist favoriteIds to localStorage
      // Overlay instances are stored in Dexie as the single source of truth
      partialize: (state) => ({
        favoriteIds: Array.from(state.favoriteIds),
      }),
      merge: (persisted, current) => {
        const data = persisted as { favoriteIds?: string[] };
        return {
          ...current,
          favoriteIds: new Set(data.favoriteIds ?? []),
        };
      },
    }
  )
);