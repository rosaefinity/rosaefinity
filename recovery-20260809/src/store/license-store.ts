// =============================================
// RosaeFinity â€” License Store (Zustand)
// Backend-authoritative: all checks go through IPC to main process.
// Frontend NEVER determines Pro status locally.
// =============================================

import { create } from 'zustand';
import { api, safeInvoke } from '../services/electron-service';
import type { LicenseV2Status, LicenseV2Features } from '../services/electron-service';

interface LicenseStore {
  // â”€â”€ State (all backend-sourced) â”€â”€
  plan: 'free' | 'pro';
  status: 'active' | 'expired' | 'suspended';
  features: LicenseV2Features;
  expiresAt: number | null;
  isInitialized: boolean;
  isLoading: boolean;
  lastError: string | null;
  userId: string | null;

  // â”€â”€ Actions â”€â”€
  initialize: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;

  // â”€â”€ Feature/Limit checks (sync, reads from cached state) â”€â”€
  hasFeature: (feature: string) => boolean;
  checkLimit: (type: 'maxActions' | 'maxScenes' | 'maxOverlayPresets', current: number) => { allowed: boolean; limit: number; remaining: boolean };
  canAccessTier: (requiredTier: string) => boolean;

  // â”€â”€ Activation â”€â”€
  activate: (opts?: { paymentId?: string }) => Promise<{ success: boolean; error?: string }>;
  deactivate: () => Promise<void>;

  // â”€â”€ Device â”€â”€
  loadDevices: () => Promise<void>;
}

const DEFAULT_FEATURES: LicenseV2Features = {
  actionsUnlimited: false,
  multiScreen: false,
  premiumOverlay: false,
  cloudBackup: false,
  maxActions: 5,
  maxScenes: 1,
  maxOverlayPresets: 10,
  maxDevices: 1,
};

export const useLicenseStore = create<LicenseStore>()(
  (set, get) => ({
    // â”€â”€ Initial state (defaults to free) â”€â”€
    plan: 'free',
    status: 'active',
    features: DEFAULT_FEATURES,
    expiresAt: null,
    isInitialized: false,
    isLoading: false,
    lastError: null,
    userId: null,

    // â”€â”€ Initialize from backend â”€â”€
    initialize: async (userId: string) => {
      if (get().isInitialized && get().userId === userId) return;
      set({ isLoading: true, lastError: null, userId });
      try {
        const a = api();
        if (!a) {
          // Not in Electron â€” default to free
          set({ isInitialized: true, isLoading: false });
          return;
        }
        const result = await safeInvoke(a.licenseV2Status, userId);
        if (result.success && result.data) {
          const s = result.data as LicenseV2Status;
          set({
            plan: s.plan,
            status: s.status,
            features: s.features,
            expiresAt: s.expiresAt,
            isInitialized: true,
            isLoading: false,
          });
        } else {
          set({ isInitialized: true, isLoading: false, lastError: result.error });
        }
      } catch (err: any) {
        set({ isInitialized: true, isLoading: false, lastError: err.message });
      }
    },

    // â”€â”€ Refresh from backend â”€â”€
    refresh: async () => {
      const { userId } = get();
      if (!userId) return;
      try {
        const a = api();
        if (!a) return;
        const result = await safeInvoke(a.licenseV2Status, userId);
        if (result.success && result.data) {
          const s = result.data as LicenseV2Status;
          set({
            plan: s.plan,
            status: s.status,
            features: s.features,
            expiresAt: s.expiresAt,
          });
        }
      } catch (err: any) {
        set({ lastError: err.message });
      }
    },

    // â”€â”€ Feature check (sync, reads from cached features) â”€â”€
    hasFeature: (feature: string) => {
      const { features } = get();
      return (features as any)[feature] === true;
    },

    // â”€â”€ Limit check â”€â”€
    checkLimit: (type, current) => {
      const { features } = get();
      const max = features[type];
      if (max === Infinity) return { allowed: true, limit: Infinity, remaining: Infinity };
      const remaining = Math.max(0, max - current);
      return { allowed: current < max, limit: max, remaining };
    },

    // â”€â”€ Tier access â”€â”€
    canAccessTier: (requiredTier: string) => {
      const { plan } = get();
      const TIER_ORDER = ['guest', 'free', 'pro', 'enterprise'];
      return TIER_ORDER.indexOf(plan) >= TIER_ORDER.indexOf(requiredTier);
    },

    // â”€â”€ Activate PRO â”€â”€
    activate: async (opts) => {
      const { userId } = get();
      if (!userId) return { success: false, error: 'Not logged in' };
      set({ isLoading: true, lastError: null });
      try {
        const a = api();
        if (!a) return { success: false, error: 'Not in Electron' };
        const result = await safeInvoke(a.licenseV2Activate, userId, opts || {});
        if (result.success && result.data?.success) {
          await get().refresh();
          set({ isLoading: false });
          return { success: true };
        }
        set({ isLoading: false, lastError: result.data?.error || 'Activation failed' });
        return { success: false, error: result.data?.error };
      } catch (err: any) {
        set({ isLoading: false, lastError: err.message });
        return { success: false, error: err.message };
      }
    },

    // â”€â”€ Deactivate â”€â”€
    deactivate: async () => {
      const { userId } = get();
      if (!userId) return;
      set({ isLoading: true });
      try {
        const a = api();
        if (!a) return;
        await safeInvoke(a.licenseV2Deactivate, userId);
        await get().refresh();
        set({ isLoading: false });
      } catch (err: any) {
        set({ isLoading: false, lastError: err.message });
      }
    },

    // â”€â”€ Load devices â”€â”€
    loadDevices: async () => {
      // Devices loaded via IPC when needed
    },
  })
);
