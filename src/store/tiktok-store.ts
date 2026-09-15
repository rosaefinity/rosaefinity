import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TikTokConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TikTokConnectionState {
  status: TikTokConnectionStatus;
  username: string;
  roomId: string;
  viewerCount: number;
  stats: {
    gifts: number;
    likes: number;
    follows: number;
    shares: number;
    comments: number;
  };
  lastError?: string;
  reconnectAttempts: number;
  isReconnecting: boolean;
  isRateLimited: boolean;
  /** Authoritative server-enforced rate limit deadline (epoch ms).
   *  Both UI and backend connection guard derive remaining time from this.
   *  When Date.now() >= serverRetryUntil, connection is allowed. */
  serverRetryUntil: number | null;
}

const DEFAULT_STATE: TikTokConnectionState = {
  status: 'disconnected',
  username: '',
  roomId: '',
  viewerCount: 0,
  stats: { gifts: 0, likes: 0, follows: 0, shares: 0, comments: 0 },
  reconnectAttempts: 0,
  isReconnecting: false,
  isRateLimited: false,
  serverRetryUntil: null,
};

interface TikTokStore {
  // Per-screen connections
  screens: Record<string, TikTokConnectionState>;

  // Actions
  connectScreen: (screenId: string, username: string) => void;
  disconnectScreen: (screenId: string) => void;
  setScreenConnected: (screenId: string, data: { username: string; roomId: string; viewerCount?: number }) => void;
  setScreenDisconnected: (screenId: string, error?: string) => void;
  setScreenViewerCount: (screenId: string, count: number) => void;
  incrementScreenStat: (screenId: string, key: keyof TikTokConnectionState['stats']) => void;
  setScreenReconnecting: (screenId: string, isReconnecting: boolean, attempt?: number) => void;
  setScreenError: (screenId: string, error: string) => void;
  setScreenRateLimited: (screenId: string, isRateLimited: boolean, serverRetryUntil: number | null) => void;

  // Legacy compat (delegates to screen-0)
  connect: (username: string) => void;
  disconnect: () => void;
  setConnected: (data: { username: string; roomId: string; viewerCount?: number }) => void;
  setDisconnected: (error?: string) => void;
  setViewerCount: (count: number) => void;
  incrementStat: (key: keyof TikTokConnectionState['stats']) => void;
  setReconnecting: (isReconnecting: boolean, attempt?: number) => void;
  setError: (error: string) => void;

  // Selectors
  getScreen: (screenId: string) => TikTokConnectionState;
}

const SCREEN_IDS = ['screen-0', 'screen-1', 'screen-2', 'screen-3', 'screen-4', 'screen-5', 'screen-6', 'screen-7'] as const;

function getDefaultScreens(): Record<string, TikTokConnectionState> {
  const screens: Record<string, TikTokConnectionState> = {};
  for (const id of SCREEN_IDS) {
    screens[id] = { ...DEFAULT_STATE };
  }
  return screens;
}

export const useTikTokStore = create<TikTokStore>()(
  persist(
    (set, get) => ({
      screens: getDefaultScreens(),

      // Per-screen actions
      connectScreen: (screenId, username) => set((state) => {
        const now = Date.now();
        const prevScreen = state.screens[screenId];
        if (prevScreen?.serverRetryUntil && prevScreen.serverRetryUntil > now) {
          console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE] BLOCKED`, JSON.stringify({
            source: "store-connectScreen",
            screenId,
            now,
            serverRetryUntilBeforeClear: prevScreen.serverRetryUntil,
            remainingMs: Math.max(0, prevScreen.serverRetryUntil - now),
            isRateLimitedBeforeClear: prevScreen.isRateLimited,
            reason: "connectScreen called but rate limit still active - NOT clearing",
          }));
          // Don't clear rate limit, just return unchanged state
          return state;
        }
        console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE]`, JSON.stringify({
          source: "store-connectScreen",
          screenId,
          now,
          serverRetryUntilBeforeClear: prevScreen?.serverRetryUntil,
          remainingMs: prevScreen?.serverRetryUntil ? Math.max(0, prevScreen.serverRetryUntil - now) : null,
          isRateLimitedBeforeClear: prevScreen?.isRateLimited,
          reason: "connectScreen - starting new connection (rate limit expired or none)",
        }));
        return {
          screens: {
            ...state.screens,
            [screenId]: { ...DEFAULT_STATE, status: 'connecting', username: username.toLowerCase().replace(/^@/, '') },
          },
        };
      }),

      disconnectScreen: (screenId) => set((state) => {
        const now = Date.now();
        const prevScreen = state.screens[screenId];
        if (prevScreen?.serverRetryUntil && prevScreen.serverRetryUntil > now) {
          console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE] BLOCKED`, JSON.stringify({
            source: "store-disconnectScreen",
            screenId,
            now,
            serverRetryUntilBeforeClear: prevScreen.serverRetryUntil,
            remainingMs: Math.max(0, prevScreen.serverRetryUntil - now),
            isRateLimitedBeforeClear: prevScreen.isRateLimited,
            reason: "disconnectScreen called but rate limit still active - NOT clearing",
          }));
          return state;
        }
        console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE]`, JSON.stringify({
          source: "store-disconnectScreen",
          screenId,
          now,
          serverRetryUntilBeforeClear: prevScreen?.serverRetryUntil,
          remainingMs: prevScreen?.serverRetryUntil ? Math.max(0, prevScreen.serverRetryUntil - now) : null,
          isRateLimitedBeforeClear: prevScreen?.isRateLimited,
          reason: "disconnectScreen - manual disconnect (rate limit expired or none)",
        }));
        return {
          screens: { ...state.screens, [screenId]: { ...DEFAULT_STATE } },
        };
      }),

      setScreenConnected: (screenId, data) => set((state) => {
        const now = Date.now();
        const prevScreen = state.screens[screenId];
        console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE]`, JSON.stringify({
          source: "store-setScreenConnected",
          screenId,
          now,
          serverRetryUntilBeforeClear: prevScreen?.serverRetryUntil,
          remainingMs: prevScreen?.serverRetryUntil ? Math.max(0, prevScreen.serverRetryUntil - now) : null,
          isRateLimitedBeforeClear: prevScreen?.isRateLimited,
          reason: "setScreenConnected - successful connection replaces rate limit",
        }));
        return {
          screens: {
            ...state.screens,
            [screenId]: {
              ...state.screens[screenId],
              status: 'connected',
              username: data.username,
              roomId: data.roomId,
              viewerCount: data.viewerCount ?? 0,
              stats: { gifts: 0, likes: 0, follows: 0, shares: 0, comments: 0 },
              reconnectAttempts: 0,
              isReconnecting: false,
              lastError: undefined,
              isRateLimited: false,
              serverRetryUntil: null,
            },
          },
        };
      }),

      setScreenDisconnected: (screenId, error) => set((state) => {
        // [TIKTOK-DISCONNECT-TRACE][STORE] Always transition to disconnected
        // — disconnect is an authoritative user action, never block it
        const now = Date.now();
        const prevScreen = state.screens[screenId];
        console.log(`[TIKTOK-DISCONNECT-TRACE][STORE]`, JSON.stringify({
          screenId,
          previousStatus: prevScreen?.status,
          previousUsername: prevScreen?.username,
          hadRateLimit: !!(prevScreen?.serverRetryUntil && prevScreen.serverRetryUntil > now),
          reason: "setScreenDisconnected — always applies",
        }));
        return {
          screens: {
            ...state.screens,
            [screenId]: { ...DEFAULT_STATE, lastError: error, status: 'disconnected' },
          },
        };
      }),

      setScreenViewerCount: (screenId, count) => set((state) => ({
        screens: {
          ...state.screens,
          [screenId]: { ...state.screens[screenId], viewerCount: count },
        },
      })),

      incrementScreenStat: (screenId, key) => set((state) => {
        const screen = state.screens[screenId];
        if (!screen) return state;
        return {
          screens: {
            ...state.screens,
            [screenId]: { ...screen, stats: { ...screen.stats, [key]: screen.stats[key] + 1 } },
          },
        };
      }),

      setScreenReconnecting: (screenId, isReconnecting, attempt) => set((state) => ({
        screens: {
          ...state.screens,
          [screenId]: {
            ...state.screens[screenId],
            isReconnecting,
            reconnectAttempts: attempt ?? state.screens[screenId].reconnectAttempts,
          },
        },
      })),

      setScreenError: (screenId, error) => set((state) => ({
        screens: {
          ...state.screens,
          [screenId]: { ...state.screens[screenId], lastError: error, status: 'error' },
        },
      })),

      setScreenRateLimited: (screenId, isRateLimited, serverRetryUntil) => set((state) => {
        const now = Date.now();
        const prevScreen = state.screens[screenId];
        console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE]`, JSON.stringify({
          source: "store-setScreenRateLimited",
          screenId,
          now,
          serverRetryUntilBeforeClear: prevScreen?.serverRetryUntil,
          remainingMs: prevScreen?.serverRetryUntil ? Math.max(0, prevScreen.serverRetryUntil - now) : null,
          isRateLimitedBeforeClear: prevScreen?.isRateLimited,
          isRateLimitedAfter: isRateLimited,
          serverRetryUntilAfter: serverRetryUntil,
          reason: isRateLimited ? "setting rate limited" : "clearing rate limit",
        }));
        return {
          screens: {
            ...state.screens,
            [screenId]: {
              ...state.screens[screenId],
              isRateLimited,
              serverRetryUntil,
              status: isRateLimited ? 'error' : 'disconnected',
              isReconnecting: false,
              reconnectAttempts: 0,
            },
          },
        };
      }),

      // Legacy compat (delegates to screen-0)
      connect: (username) => get().connectScreen('screen-0', username),
      disconnect: () => get().disconnectScreen('screen-0'),
      setConnected: (data) => get().setScreenConnected('screen-0', data),
      setDisconnected: (error) => get().setScreenDisconnected('screen-0', error),
      setViewerCount: (count) => get().setScreenViewerCount('screen-0', count),
      incrementStat: (key) => get().incrementScreenStat('screen-0', key),
      setReconnecting: (isReconnecting, attempt) => get().setScreenReconnecting('screen-0', isReconnecting, attempt),
      setError: (error) => get().setScreenError('screen-0', error),

      // Selector
      getScreen: (screenId) => get().screens[screenId] ?? DEFAULT_STATE,
    }),
    {
      name: 'rf-tiktok-connections',
      partialize: (state) => ({
        screens: Object.fromEntries(
          Object.entries(state.screens).map(([id, screen]) => [
            id,
            {
              ...screen,
              // Do NOT persist ephemeral rate-limit state
              // Server controls the cooldown lifecycle on startup
              isRateLimited: false,
              serverRetryUntil: null,
            },
          ])
        ),
      }),
    }
  )
);

// Convenience selectors
export const selectScreenConnection = (screenId: string) => (state: TikTokStore) => state.screens[screenId] ?? DEFAULT_STATE;
export const selectScreenStatus = (screenId: string) => (state: TikTokStore) => state.screens[screenId]?.status ?? 'disconnected';
export const selectScreenUsername = (screenId: string) => (state: TikTokStore) => state.screens[screenId]?.username ?? '';
export const selectScreenViewerCount = (screenId: string) => (state: TikTokStore) => state.screens[screenId]?.viewerCount ?? 0;
export const selectScreenStats = (screenId: string) => (state: TikTokStore) => state.screens[screenId]?.stats ?? DEFAULT_STATE.stats;
export const selectScreenRoomId = (screenId: string) => (state: TikTokStore) => state.screens[screenId]?.roomId ?? '';
export const selectScreenIsReconnecting = (screenId: string) => (state: TikTokStore) => state.screens[screenId]?.isReconnecting ?? false;
export const selectScreenReconnectAttempts = (screenId: string) => (state: TikTokStore) => state.screens[screenId]?.reconnectAttempts ?? 0;
export const selectScreenLastError = (screenId: string) => (state: TikTokStore) => state.screens[screenId]?.lastError;
export const selectScreenIsRateLimited = (screenId: string) => (state: TikTokStore) => state.screens[screenId]?.isRateLimited ?? false;
export const selectScreenServerRetryUntil = (screenId: string) => (state: TikTokStore) => state.screens[screenId]?.serverRetryUntil ?? null;