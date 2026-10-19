// =============================================
// RosaeFinity — License Store (Zustand)
// Backend-authoritative: always fetches subscription from REST API.
// Electron and browser use the SAME code path — no IPC for license status.
// Frontend NEVER determines Pro status locally.
// =============================================

import { create } from 'zustand';
import { api, safeInvoke } from '../services/electron-service';
import type { LicenseV2Status, LicenseV2Features } from '../services/electron-service';
import { useAuthStore } from './auth-store';
import { API_URL } from '../lib/api-url';

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

  // — Centralized subscription state —
  /** Whether Pro subscription is currently active (plan=pro AND not expired) */
  isProActive: () => boolean;
  /** Whether user is lifetime Pro (plan=pro AND no expiration date) */
  isLifetimePro: () => boolean;
  /** Effective plan considering expiration: 'pro' if active, 'free' otherwise */
  effectivePlan: () => 'pro' | 'free';
  /** Max stream profiles allowed: 10 if Pro active, 1 otherwise */
  getMaxStreamProfiles: () => number;

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
 * Fetch subscription from the backend API.
 * Used by both Electron and browser — single unified code path.
 */
async function fetchSubscriptionFromAPI(): Promise<{ plan: string; status: string; features: LicenseV2Features; expiresAt: number | null } | null> {
  const session = useAuthStore.getState().session;
  if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] auth initialized', { hasSession: !!session, hasToken: !!session?.accessToken });
  if (!session?.accessToken) {
    if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] access token NOT present — returning null');
    return null;
  }
  if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] access token present');
  try {
    const url = `${API_URL}/v1/auth/subscription`;
    if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] subscription request URL', { url, isElectron: !!api() });
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] subscription HTTP response', { status: res.status, ok: res.ok });
    const json = await res.json();
    if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] subscription raw response', { success: json.success, plan: json.data?.plan, status: json.data?.status });
    if (json.success && json.data) {
      if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] fetched subscription from API:', json.data);
      return {
        plan: json.data.plan || 'free',
        status: json.data.status || 'active',
        features: json.data.features || DEFAULT_FEATURES,
        expiresAt: json.data.expiresAt,
      };
    }
    return null;
  } catch (err) {
    console.error('[ENTITLEMENT-ELECTRON] API fetch failed:', err);
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

    // — Initialize from backend (single path: always fetch from REST API) —
    initialize: async (userId: string) => {
      if (get().isInitialized && get().userId === userId) return;
      const prevPlan = get().plan;
      const wasInit = get().isInitialized;
      set({ isLoading: true, lastError: null, userId });
      try {
        if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] initLicense start', { userId, isElectron: !!api(), wasInitialized: wasInit });
        const sub = await fetchSubscriptionFromAPI();
        if (sub) {
          if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] normalized subscription', { plan: sub.plan, status: sub.status });
          if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] store before update', { prevPlan });
          set({
            plan: sub.plan as 'free' | 'pro',
            status: sub.status as 'active' | 'expired' | 'suspended',
            features: sub.features,
            expiresAt: sub.expiresAt,
            isInitialized: true,
            isLoading: false,
          });
          // Notify listeners (e.g. app-store profile lock recalculation) that entitlements are now authoritative
          window.dispatchEvent(new CustomEvent('rosae:license-updated'));
          if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] store after update', { plan: sub.plan, wasStaleFree: prevPlan === 'free' && sub.plan === 'pro' });
        } else {
          if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] no subscription found, defaulting to free');
          set({ isInitialized: true, isLoading: false });
          window.dispatchEvent(new CustomEvent('rosae:license-updated'));
        }
      } catch (err: any) {
        console.error('[ENTITLEMENT-ELECTRON] initialize error:', err);
        set({ isInitialized: true, isLoading: false, lastError: err.message });
        window.dispatchEvent(new CustomEvent('rosae:license-updated'));
      }
    },

    // — Refresh from backend (single path: always fetch from REST API) —
    refresh: async () => {
      const { userId } = get();
      if (!userId) return;
      try {
        if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] refresh start', { userId });
        const sub = await fetchSubscriptionFromAPI();
        if (sub) {
          if (typeof window !== 'undefined' && window.localStorage?.getItem('rf_overlay_debug') === '1') console.log('[ENTITLEMENT-ELECTRON] refresh normalized', { plan: sub.plan, status: sub.status });
          set({
            plan: sub.plan as 'free' | 'pro',
            status: sub.status as 'active' | 'expired' | 'suspended',
            features: sub.features,
            expiresAt: sub.expiresAt,
          });
          // Notify listeners (e.g. app-store profile lock recalculation) that entitlements have changed
          window.dispatchEvent(new CustomEvent('rosae:license-updated'));
        }
      } catch (err: any) {
        set({ lastError: err.message });
      }
    },

    // — Centralized subscription state —
    isProActive: () => {
      const { plan, expiresAt, isInitialized } = get();
      if (!isInitialized || plan !== 'pro') return false;
      if (!expiresAt) return true; // Lifetime Pro
      return Date.now() < expiresAt;
    },

    isLifetimePro: () => {
      const { plan, expiresAt, isInitialized } = get();
      return isInitialized && plan === 'pro' && !expiresAt;
    },

    effectivePlan: () => {
      const { plan, expiresAt, isInitialized } = get();
      if (!isInitialized) return 'free';
      if (plan !== 'pro') return 'free';
      if (expiresAt && Date.now() >= expiresAt) return 'free';
      return 'pro';
    },

    getMaxStreamProfiles: () => {
      const { effectivePlan } = get();
      return effectivePlan() === 'pro' ? 10 : 1;
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
