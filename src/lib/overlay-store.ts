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
  loadInstances: () => Promise<void>;
  persistInstance: (instance: OverlayInstance) => Promise<void>;
  deleteInstanceFromDB: (id: string) => Promise<void>;
}

export const useOverlayStore = create<OverlayStore>()(
  persist(
    (set, get) => ({
      instances: [],
      loaded: false,
      favoriteIds: new Set<string>(),

      addInstance: (params) => {
        const now = Date.now();
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
        };

        set((state) => ({ instances: [...state.instances, instance] }));
        get().persistInstance(instance);
        return instance;
      },

      updateConfig: (id, config) => {
        console.log('[GOAL-SYNC-3] updateConfig:', { id });
        set((state) => ({
          instances: state.instances.map((inst) =>
            inst.id === id ? { ...inst, config, updatedAt: Date.now() } : inst
          ),
        }));

        const updated = get().getInstance(id);
        if (updated) {
          console.log('[GOAL-SYNC-3] persistInstance called:', { moduleId: updated.moduleId });
          get().persistInstance(updated);
        }
      },

      toggleEnabled: (id) => {
        set((state) => ({
          instances: state.instances.map((inst) =>
            inst.id === id ? { ...inst, enabled: !inst.enabled, updatedAt: Date.now() } : inst
          ),
        }));

        const updated = get().getInstance(id);
        if (updated) get().persistInstance(updated);
      },

      removeInstance: (id) => {
        set((state) => ({
          instances: state.instances.filter((inst) => inst.id !== id),
        }));
        get().deleteInstanceFromDB(id);
      },

      renameInstance: (id, name) => {
        set((state) => ({
          instances: state.instances.map((inst) =>
            inst.id === id ? { ...inst, name, updatedAt: Date.now() } : inst
          ),
        }));

        const updated = get().getInstance(id);
        if (updated) get().persistInstance(updated);
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

        const now = Date.now();
        const duplicate: OverlayInstance = {
          ...original,
          id: crypto.randomUUID(),
          name: `${original.name} (Copy)`,
          browserSourceId: crypto.randomUUID(),
          config: resolveConfig(original.config),
          createdAt: now,
          updatedAt: now,
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

      loadInstances: async () => {
        try {
          const rawInstances = await getAllOverlayInstances();
          // Resolve configs to fill any missing base fields (position, size, etc.)
          const instances = rawInstances.map((inst) => ({
            ...inst,
            config: resolveConfig(inst.config),
          }));
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