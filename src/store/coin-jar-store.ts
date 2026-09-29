// ─────────────────────────────────────────────────────
// RosaeFinity — Coin Jar Pro Store
// Persistent configuration + runtime state for Coin Jar
// ─────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CoinJarProConfig } from '../overlays/coin-jar-pro/types';
import { defaultCoinJarProConfig } from '../overlays/coin-jar-pro/types';
import { sendToOverlay } from '../lib/overlay-bus';

// ─── Deduplication ────────────────────────────────────

/** How long (ms) a gift fingerprint is remembered to prevent duplicates */
const DEDUP_WINDOW_MS = 2000;

/** Maximum fingerprints to retain */
const DEDUP_MAX_SIZE = 200;

const recentGiftFingerprints = new Set<string>();

/**
 * Build a dedup fingerprint for a normalized TikTok gift event.
 * Uses: giftId + userId + repeatCount + timestamp bucket (2s window).
 */
export function buildGiftFingerprint(
  giftId: string | number,
  userId: string,
  repeatCount: number,
  timestamp: number,
): string {
  const bucket = Math.floor(timestamp / DEDUP_WINDOW_MS);
  return `${giftId}:${userId}:${repeatCount}:${bucket}`;
}

/** Check if a gift fingerprint was recently seen; if not, register it. */
export function isDuplicateGift(
  giftId: string | number,
  userId: string,
  repeatCount: number,
  timestamp: number,
): boolean {
  const fp = buildGiftFingerprint(giftId, userId, repeatCount, timestamp);
  if (recentGiftFingerprints.has(fp)) return true;
  recentGiftFingerprints.add(fp);
  // Evict oldest entries when the set grows too large
  if (recentGiftFingerprints.size > DEDUP_MAX_SIZE) {
    const arr = Array.from(recentGiftFingerprints);
    for (let i = 0; i < arr.length - DEDUP_MAX_SIZE / 2; i++) {
      recentGiftFingerprints.delete(arr[i]);
    }
  }
  return false;
}

// ─── Store Types ──────────────────────────────────────

export interface CoinJarStoreConfig {
  /** Coin Jar Pro configuration (goal, colors, font, etc.) */
  config: CoinJarProConfig;
}

export interface CoinJarStoreState {
  /** Current accumulated coin amount (runtime, starts at 0) */
  currentAmount: number;
  /** Timestamp of the last update */
  lastUpdatedAt: number;
}

export interface CoinJarStoreActions {
  /** Save configuration (goal, appearance, etc.) */
  saveConfig: (config: CoinJarProConfig) => void;

  /** Add coins from a real TikTok gift event */
  addGiftAmount: (amount: number, giftName?: string, giftId?: string, giftImageUrl?: string) => void;

  /** Set the current amount directly (for state hydration from SSE) */
  setCurrentAmount: (amount: number) => void;

  /** Reset Coin Jar to zero */
  reset: () => void;

  /** Get the current Coin Jar state as a plain object (for SSE state sync) */
  getStatePayload: () => { currentAmount: number; goalAmount: number; config: CoinJarProConfig };
}

export type CoinJarStore = CoinJarStoreConfig & CoinJarStoreState & CoinJarStoreActions;

// ─── Store ────────────────────────────────────────────

export const useCoinJarStore = create<CoinJarStore>()(
  persist(
    (set, get) => ({
      // ── Config (persisted) ──
      config: { ...defaultCoinJarProConfig },

      // ── Runtime state (persisted) ──
      currentAmount: 0,
      lastUpdatedAt: 0,

      // ── Actions ──

      saveConfig: (config) => {
        set({ config });
        // Broadcast state change to Browser Sources
        const { currentAmount } = get();
        sendToOverlay({
          type: 'coin-jar-state',
          screen: '',
          actionName: 'Coin Jar',
          currentAmount,
          goalAmount: config.goalCoins,
          config,
          timestamp: Date.now(),
        });
        console.log('[COIN-JAR-TRACE] state broadcast (config updated)');
      },

      addGiftAmount: (amount, giftName, giftId, giftImageUrl) => {
        if (amount <= 0) return;

        set((s) => {
          const newTotal = s.currentAmount + amount;
          const goalAmount = s.config.goalCoins;
          // Broadcast gift event to Browser Sources (with gift metadata for image resolution)
          const ssePayload = {
            type: 'coin-jar-gift',
            screen: '',
            actionName: 'Coin Jar',
            giftData: { amount, giftName: giftName || 'Gift', giftId: giftId || '', giftImageUrl: giftImageUrl || '', timestamp: Date.now() },
            currentAmount: newTotal,
            goalAmount,
            timestamp: Date.now(),
          };
          sendToOverlay(ssePayload);

          return { currentAmount: newTotal, lastUpdatedAt: Date.now() };
        });
      },

      setCurrentAmount: (amount) => {
        set({ currentAmount: amount, lastUpdatedAt: Date.now() });
        console.log('[COIN-JAR-TRACE] amount set (hydration)', { amount });
      },

      reset: () => {
        set({ currentAmount: 0, lastUpdatedAt: Date.now() });
        const { config } = get();
        console.log('[COIN-JAR-TRACE] reset');
        // Broadcast reset state to Browser Sources (includes reset flag to clear accumulated gifts)
        sendToOverlay({
          type: 'coin-jar-state',
          screen: '',
          actionName: 'Coin Jar',
          currentAmount: 0,
          goalAmount: config.goalCoins,
          config,
          reset: true,
          timestamp: Date.now(),
        });
        console.log('[COIN-JAR-TRACE] state broadcast (reset)');
      },

      getStatePayload: () => {
        const s = get();
        return {
          currentAmount: s.currentAmount,
          goalAmount: s.config.goalCoins,
          config: s.config,
        };
      },
    }),
    {
      name: 'rf-coin-jar',
      partialize: (state) => ({
        config: state.config,
        currentAmount: state.currentAmount,
        lastUpdatedAt: state.lastUpdatedAt,
      }),
    },
  ),
);
