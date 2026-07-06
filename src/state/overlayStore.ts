import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getOverlayModule, hasOverlay } from '../overlays/registry';
import type { AnyOverlayModule } from '../overlays/types';

interface OverlayState {
  /** IDs of overlays the user has activated */
  activeOverlays: string[];
}

interface OverlayActions {
  /** Toggle an overlay on/off. Throws if id is not registered. */
  toggleOverlay: (id: string) => void;
  /** Enable an overlay. No-op if already active. Throws if id is not registered. */
  enableOverlay: (id: string) => void;
  /** Disable an overlay. No-op if already inactive. */
  disableOverlay: (id: string) => void;
  /** Deactivate all overlays. */
  clearAllOverlays: () => void;
}

type OverlayStore = OverlayState & OverlayActions;

/** Resolve a list of overlay IDs to their module descriptors. */
function resolveModules(ids: string[]): AnyOverlayModule[] {
  return ids
    .map((id) => getOverlayModule(id))
    .filter((m): m is AnyOverlayModule => m !== undefined);
}

export const useOverlayStore = create<OverlayStore>()(
  persist(
    (set, get) => ({
      activeOverlays: [],

      toggleOverlay: (id) => {
        if (!hasOverlay(id)) {
          throw new Error(`Cannot toggle overlay "${id}": not found in registry.`);
        }

        const { activeOverlays } = get();
        const isActive = activeOverlays.includes(id);

        set({
          activeOverlays: isActive
            ? activeOverlays.filter((oid) => oid !== id)
            : [...activeOverlays, id],
        });
      },

      enableOverlay: (id) => {
        if (!hasOverlay(id)) {
          throw new Error(`Cannot enable overlay "${id}": not found in registry.`);
        }

        const { activeOverlays } = get();
        if (activeOverlays.includes(id)) return; // already active

        set({ activeOverlays: [...activeOverlays, id] });
      },

      disableOverlay: (id) => {
        const { activeOverlays } = get();
        if (!activeOverlays.includes(id)) return; // already inactive

        set({ activeOverlays: activeOverlays.filter((oid) => oid !== id) });
      },

      clearAllOverlays: () => {
        set({ activeOverlays: [] });
      },
    }),
    {
      name: 'rf-overlay-active',
      partialize: (state) => ({ activeOverlays: state.activeOverlays }),
    }
  )
);

// ─── Selector Helpers (framework-agnostic) ───

/** Check if a specific overlay is active. */
export function isOverlayActive(id: string): boolean {
  return useOverlayStore.getState().activeOverlays.includes(id);
}

/** Get all active overlay modules resolved from the registry. */
export function getActiveOverlays(): AnyOverlayModule[] {
  return resolveModules(useOverlayStore.getState().activeOverlays);
}

/** Get the raw list of active overlay IDs. */
export function getActiveOverlayIds(): readonly string[] {
  return useOverlayStore.getState().activeOverlays;
}
