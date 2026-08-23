// =============================================
// RosaeFinity — License Store (Zustand)
// Backend-authoritative: all checks go through IPC (Electron) or API (web).
// Frontend NEVER determines Pro status locally.
// =============================================

import { create } from 'zustand';
import { api, safeInvoke } from '../services/electron-service';
import type { LicenseV2Status, LicenseV2Features } from '../services/electron-service';
import { useAuthStore } from './auth-store';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '');

interface LicenseStore {
  // — State (all backend-sourced) —
  plan: 'free' | 'pro';
  status: 'active' | 'expired' | 'suspended';
  features: LicenseV2Features;
  expiresAt: number | null;
  isInitialized: boolean;
  isLoading: boolean;
  lastError: string | null;
  userId: string | null;

  // — Actions —
  initialize: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;

  // — Feature/Limit checks (sync, reads from cached state) —
  hasFeature: (feature: string) => boolean;
  checkLimit: (type: 'maxActions' | 'maxScenes' | 'maxOverlayPresets', current: number) => { allowed: boolean; limit: number; remaining: number };
  canAccessTier: (requiredTier: string) => boolean;

  // — Activation —
  activate: (opts?: { paymentId?: string }) => Promise<{ success: boolean; error?: string }>;
  deactivate: () => Promise<void>;

  // — Device —
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

/**
 * Fetch subscription from the backend API (web mode).
 * Used when Electron IPC is unavailable.
 */
async function fetchSubscriptionFromAPI(): Promise<{ plan: string; status: string; features: LicenseV2Features; expiresAt: number | null } | null> {
  const session = useAuthStore.getState().session;
  if (!session?.accessToken) return null;
  try {
    const res = await fetch(`${API_URL}/v1/auth/subscription`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const json = await res.json();
    if (json.success && json.data) {
      console.log('[ENTITLEMENT] fetched subscription from API:', json.data);
      return {
        plan: json.data.plan || 'free',
        status: json.data.status || 'active',
        features: json.data.features || DEFAULT_FEATURES,
        expiresAt: json.data.expiresAt,
      };
    }
    return null;
  } catch (err) {
    console.error('[ENTITLEMENT] API fetch failed:', err);
    return null;
  }
}

export const useLicenseStore = create<LicenseStore>()(
  (set, get) => ({
    // — Initial state (defaults to free) —
    plan: 'free',
    status: 'active',
    features: DEFAULT_FEATURES,
    expiresAt: null,
    isInitialized: false,
    isLoading: false,
    lastError: null,
    userId: null,

    // — Initialize from backend —
    initialize: async (userId: string) => {
      if (get().isInitialized && get().userId === userId) return;
      set({ isLoading: true, lastError: null, userId });
      try {
        const a = api();
        if (a) {
          // Electron: use IPC
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
        } else {
          // Web mode: fetch subscription from REST API
          const sub = await fetchSubscriptionFromAPI();
          if (sub) {
            set({
              plan: sub.plan as 'free' | 'pro',
              status: sub.status as 'active' | 'expired' | 'suspended',
              features: sub.features,
              expiresAt: sub.expiresAt,
              isInitialized: true,
              isLoading: false,
            });
          } else {
            console.log('[ENTITLEMENT] no subscription found, defaulting to free');
            set({ isInitialized: true, isLoading: false });
          }
        }
      } catch (err: any) {
        console.error('[ENTITLEMENT] initialize error:', err);
        set({ isInitialized: true, isLoading: false, lastError: err.message });
      }
    },

    // — Refresh from backend —
    refresh: async () => {
      const { userId } = get();
      if (!userId) return;
      try {
        const a = api();
        if (a) {
          // Electron: use IPC
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
        } else {
          // Web mode: fetch from API
          const sub = await fetchSubscriptionFromAPI();
          if (sub) {
            set({
              plan: sub.plan as 'free' | 'pro',
              status: sub.status as 'active' | 'expired' | 'suspended',
              features: sub.features,
              expiresAt: sub.expiresAt,
            });
          }
        }
      } catch (err: any) {
        set({ lastError: err.message });
      }
    },

    // — Feature check (sync, reads from cached features) —
    hasFeature: (feature: string) => {
      const { features } = get();
      return (features as any)[feature] === true;
    },

    // — Limit check —
    checkLimit: (type, current) => {
      const { features } = get();
      const max = features[type];
      if (max === Infinity || max === null) return { allowed: true, limit: Infinity, remaining: Infinity };
      const remaining = Math.max(0, max - current);
      return { allowed: current < max, limit: max, remaining };
    },

    // — Tier access —
    canAccessTier: (requiredTier: string) => {
      const { plan } = get();
      const TIER_ORDER = ['guest', 'free', 'pro', 'enterprise'];
      return TIER_ORDER.indexOf(plan) >= TIER_ORDER.indexOf(requiredTier);
    },

    // — Activate PRO —
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

    // — Deactivate —
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

    // — Load devices —
    loadDevices: async () => {
      // Devices loaded via IPC when needed
    },
  })
);
