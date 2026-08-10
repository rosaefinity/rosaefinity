import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OverlayInstance } from '../overlays/types';
import { resolveConfig } from '../overlays/createConfig';
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
        set((state) => ({
          instances: state.instances.map((inst) =>
            inst.id === id ? { ...inst, config, updatedAt: Date.now() } : inst
          ),
        }));

        const updated = get().getInstance(id);
        if (updated) get().persistInstance(updated);
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
          // Sync to main process for SSE config endpoint
          syncInstancesToMain(instances);
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