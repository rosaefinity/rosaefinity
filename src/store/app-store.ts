import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Action, Event, CustomSound, Stats, LiveEvent, TikTokGift, SetupConfig, LicenseInfo, StreamProfile, ScreenId, ScreenConnectionState, TikTokConnectionState } from "../types";
import { SCREEN_IDS } from "../types";
import { db, getActionMedia, getActionMediaArray, deleteActionMedia } from "../lib/db";
import { useLicenseStore } from "./license-store";

interface AppStore {
  // Actions
  actions: Action[];
  addAction: (action: Omit<Action, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  /**
   * Action Pack import only: dual-write imported Actions into an explicit
   * target profile (captured at import start). Never creates, switches, or
   * replaces Stream Profiles. Never calls cloud profile sync.
   *
   * @param importedActions - Actions returned by importActionPack (IDs already remapped)
   * @param explicitTargetProfileId - currentProfileId captured when the import
   *   started (before async media restore). Falls back to live currentProfileId.
   */
  importActionsToCurrentProfile: (
    actions: Action[],
    explicitTargetProfileId?: string | null,
  ) => Promise<{
    targetProfileId: string | null;
    finalCurrentProfileId: string | null;
    importedActionCount: number;
    profileCountBefore: number;
    profileCountAfter: number;
  }>;
  updateAction: (id: string, action: Partial<Action>) => Promise<void>;
  deleteAction: (id: string) => void;
  duplicateAction: (id: string) => void;

  // Events
  events: Event[];
  addEvent: (event: Omit<Event, "id" | "createdAt" | "updatedAt">) => void;
  updateEvent: (id: string, event: Partial<Event>) => void;
  deleteEvent: (id: string) => void;

  // Sounds
  customSounds: CustomSound[];
  addSound: (sound: Omit<CustomSound, "id" | "createdAt">) => void;
  addImportedSound: (sound: CustomSound) => void;
  updateSound: (id: string, updates: Partial<CustomSound>) => void;
  deleteSound: (id: string) => void;

  // Stats
  stats: Stats;
  setStats: (stats: Partial<Stats>) => void;
  incrementStat: (key: keyof Stats, value?: number) => void;

  // Live connection
  isLive: boolean;
  liveUsername: string;
  setConnected: (username: string) => void;
  setDisconnected: () => void;

  // TikTok Gifts
  tikTokGifts: TikTokGift[];
  setTikTokGifts: (gifts: TikTokGift[]) => void;

  // License
  licenseInfo: LicenseInfo;
  setLicenseInfo: (info: Partial<LicenseInfo>) => void;

  // Setup Config
  setupConfig: SetupConfig;
  updateSetupConfig: (config: Partial<SetupConfig>) => void;

  // Stream Profiles
  streamProfiles: StreamProfile[];
  currentProfileId: string | null;
  addProfile: (profile: Omit<StreamProfile, "id" | "createdAt" | "updatedAt">) => void;
  updateProfile: (id: string, updates: Partial<StreamProfile>) => void;
  deleteProfile: (id: string) => void;
  setCurrentProfile: (id: string | null) => void;
  switchProfile: (targetId: string) => void;
  replaceProfiles: (profiles: StreamProfile[]) => void;
  applyProfileImport: (profileConfig: Record<string, unknown>) => void;
  importProfilesByName: (importedProfiles: StreamProfile[]) => void;
  pullCloudProfiles: (userId: string) => Promise<void>;
  migrateLocalProfilesToCloud: (userId: string) => Promise<void>;
  resetProfiles: () => void;
  _isRehydrating: boolean;
  _setRehydrating: (v: boolean) => void;

  // Live events feed
  liveEvents: LiveEvent[];
  addLiveEvent: (event: LiveEvent) => void;
  clearLiveEvents: () => void;

  // Points System
  pointsUsers: Record<string, { username: string; name: string; points: number; level: number; giftCount: number; likeCount: number; followCount: number; commentCount: number; shareCount: number; firstSeen: number; lastSeen: number }>;
  pointsConfig: { currencyName: string; pointsGift: number; pointsLike: number; pointsFollow: number; pointsComment: number; pointsShare: number; pointsSubscribe: number; subBonus: number; levelPoints: number; levelMultiplier: number };
  updatePointsConfig: (config: Partial<AppStore["pointsConfig"]>) => void;
  awardPoints: (type: "gift" | "like" | "follow" | "comment" | "share" | "subscribe", username: string, nickname: string, count?: number) => void;
  deductPoints: (username: string, amount: number) => boolean;
  resetAllPoints: () => void;
  halvePoints: (percent: number) => void;

  // Alert Settings
  alertSettings: Record<string, { enabled: boolean; minDiamond?: number; minLikes?: number; duration: number; sound?: string; color?: string; keyword?: string }>;
  updateAlertSetting: (event: string, settings: Partial<AppStore["alertSettings"][string]>) => void;
  // alertsMasterEnabled is now per-profile in StreamProfile — read/write via current profile
  getAlertsMasterEnabled: () => boolean;
  setAlertsMasterEnabled: (enabled: boolean) => void;

  // Spotify
  spotifyConnected: boolean;
  spotifyNowPlaying: { name: string; artist: string; albumArt: string; progressMs: number; durationMs: number; isPlaying: boolean } | null;
  spotifyQueue: { user: string; nickname: string; track: SpotifyTrack; timestamp: number }[];
  setSpotifyConnected: (connected: boolean) => void;
  setSpotifyNowPlaying: (np: AppStore["spotifyNowPlaying"]) => void;
  setSpotifyQueue: (q: AppStore["spotifyQueue"]) => void;

  // OBS Connection
  obsConnected: boolean;
  setObsConnected: (connected: boolean) => void;

  // Streamer.bot Connection
  sbConnected: boolean;
  setSbConnected: (connected: boolean) => void;

  // Minecraft
  mcConnected: boolean;
  setMcConnected: (connected: boolean) => void;

  // Dexie hydration — restore media stripped by partialize
  hydrateMedia: () => Promise<void>;

  // ══ TIKTOK CONNECTION STATE ══
  tikTokConnection: TikTokConnectionState;
  setTikTokConnected: (username: string, roomId: string) => void;
  setTikTokDisconnected: () => void;
  setTikTokStats: (stats: Partial<Stats>) => void;
  setTikTokReconnecting: (isReconnecting: boolean) => void;

  // ══ MULTI-SCREEN CONNECTION STATE ══
  screenConnections: Record<ScreenId, ScreenConnectionState>;
  setScreenConnected: (screenId: ScreenId, username: string) => void;
  setScreenDisconnected: (screenId: ScreenId) => void;
  incrementScreenStat: (screenId: ScreenId, key: keyof Stats, value?: number) => void;
  setScreenStats: (screenId: ScreenId, stats: Partial<Stats>) => void;

  screenTikTokNames: Record<ScreenId, string>;
  setScreenTikTokName: (screenId: ScreenId, name: string) => void;

  screenLiveEvents: Record<ScreenId, LiveEvent[]>;
  addScreenLiveEvent: (screenId: ScreenId, event: LiveEvent) => void;
  clearScreenLiveEvents: (screenId: ScreenId) => void;
}

import type { SpotifyTrack } from "../types";
import { normalizeObsEndpointOnRehydrate } from "../lib/obs-local";

const DEFAULT_SETUP: SetupConfig = {
  tikTokName: "",
  screenTikTokNames: {} as Record<ScreenId, string>,
  currencyName: "Points",
  pointsGift: 3, pointsLike: 1, pointsFollow: 5, pointsComment: 1, pointsShare: 2, pointsSubscribe: 10,
  subBonus: 0, levelPoints: 50, levelMultiplier: 1.03,
  obsIp: "127.0.0.1", obsPort: 4455, obsPassword: "",
  sbAddress: "127.0.0.1", sbPort: 8080, sbEndpoint: "/",
  mcIp: "127.0.0.1", mcPort: 4567, mcPassword: "change_me",
  mcMode: "servertap", mcPlayer: "",
  spotifyEnabled: true, spotifyClientId: "",
  tikTokLang: "id-ID", debugMode: false,
  playEnabled: true, playCost: 20,
  skipEnabled: true, skipCost: 200, skipRequestedEnabled: true,
  explicitEnabled: false, maxQueueOverall: 5, maxQueuePerUser: 2,
  overlayPermanent: false,
  halvingPercent: 50,
  overlayScreensMaxQueue: {
    "screen-0": 5,
    "screen-1": 5,
    "screen-2": 5,
    "screen-3": 5,
    "screen-4": 5,
    "screen-5": 5,
    "screen-6": 5,
    "screen-7": 5,
  },
};

const DEFAULT_LICENSE: LicenseInfo = {
  isPro: false, plan: "free",
  limits: { actions: 5, customSounds: 3, streamProfiles: 1 },
};

const DEFAULT_ALERTS: Record<string, { enabled: boolean; minDiamond?: number; minLikes?: number; duration: number; sound?: string; color?: string; keyword?: string }> = {
  gift: { enabled: true, minDiamond: 0, duration: 5, color: "#e0306a" },
  follow: { enabled: true, duration: 4, color: "#4e7bff" },
  like: { enabled: false, minLikes: 100, duration: 3, color: "#e0306a" },
  share: { enabled: true, duration: 4, color: "#3ecf8e" },
  comment: { enabled: false, duration: 4, color: "#f0a020" },
  subscribe: { enabled: true, duration: 5, color: "#a855f7" },
};

const DEFAULT_STREAM_PROFILES: StreamProfile[] = [
  { id: "profile-1", name: "Stream Profile 1", icon: "🌹", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-2", name: "Stream Profile 2", icon: "🔥", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-3", name: "Stream Profile 3", icon: "🎮", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-4", name: "Stream Profile 4", icon: "❤️", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-5", name: "Stream Profile 5", icon: "💬", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-6", name: "Stream Profile 6", icon: "🎁", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-7", name: "Stream Profile 7", icon: "🙂", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-8", name: "Stream Profile 8", icon: "👍", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-9", name: "Stream Profile 9", icon: "📞", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-10", name: "Stream Profile 10", icon: "☑️", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const DEFAULT_POINTS_CONFIG = {
  currencyName: "Points",
  pointsGift: 3, pointsLike: 1, pointsFollow: 5, pointsComment: 1, pointsShare: 2, pointsSubscribe: 10,
  subBonus: 0, levelPoints: 50, levelMultiplier: 1.03,
};

const DEFAULT_TIKTOK_CONNECTION: TikTokConnectionState = {
  status: "disconnected",
  username: "",
  roomId: "",
  viewerCount: 0,
  stats: { gifts: 0, likes: 0, views: 0, follows: 0 },
  reconnectAttempts: 0,
  isReconnecting: false,
};

// ── Per-screen defaults ──
const DEFAULT_SCREEN_CONNECTIONS: Record<ScreenId, ScreenConnectionState> = {} as any;
const DEFAULT_SCREEN_EVENTS: Record<ScreenId, LiveEvent[]> = {} as any;
const DEFAULT_SCREEN_NAMES: Record<ScreenId, string> = {} as any;
for (const id of SCREEN_IDS) {
  DEFAULT_SCREEN_CONNECTIONS[id] = { screenId: id, isLive: false, username: "", roomId: "", viewerCount: 0, status: "disconnected", reconnectAttempts: 0, isReconnecting: false, stats: { gifts: 0, likes: 0, views: 0, follows: 0 } };
  DEFAULT_SCREEN_EVENTS[id] = [];
  DEFAULT_SCREEN_NAMES[id] = "";
}

function calculateLevel(totalPoints: number, config: AppStore["pointsConfig"]): number {
  const base = config.levelPoints || 50;
  const mult = config.levelMultiplier || 1.03;
  let level = 1;
  let required = base;
  let cumulative = 0;
  while (cumulative + required <= totalPoints) {
    cumulative += required;
    level++;
    required = Math.round(base * Math.pow(mult, level - 1));
    if (level > 100) break;
  }
  return level;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      actions: [],
      events: [],
      customSounds: [],
      stats: { gifts: 0, likes: 0, views: 0, follows: 0 },
      isLive: false,
      liveUsername: "",
      tikTokGifts: [],
      licenseInfo: DEFAULT_LICENSE,
      setupConfig: DEFAULT_SETUP,
      streamProfiles: DEFAULT_STREAM_PROFILES,
      currentProfileId: "profile-1",
      _isRehydrating: true,
      liveEvents: [],
      pointsUsers: {},
      pointsConfig: DEFAULT_POINTS_CONFIG,
      alertSettings: DEFAULT_ALERTS,
      spotifyConnected: false,
      spotifyNowPlaying: null,
      spotifyQueue: [],
      obsConnected: false,
      sbConnected: false,
      mcConnected: false,

      // ══ TikTok connection state ══
      tikTokConnection: { ...DEFAULT_TIKTOK_CONNECTION },

      // ══ Per-screen connection state ══
      screenConnections: { ...DEFAULT_SCREEN_CONNECTIONS },
      screenLiveEvents: { ...DEFAULT_SCREEN_EVENTS },
      screenTikTokNames: { ...DEFAULT_SCREEN_NAMES },

      // ══ Actions CRUD ══════════════════════════════
      // Actions are dual-written: top-level `actions` (UI runtime) AND
      // streamProfiles[currentProfileId].actions (persisted profile snapshot).
      // Zustand persist saves both; cloud pull / profile switch read profile.actions.
      // Without profile sync, create→refresh wipes actions when pullCloudProfiles
      // reloads profile.actions (still []) over top-level state.
      addAction: async (action) => {
        const now = new Date().toISOString();
        const newAction: Action = {
          ...action,
          id: "act_" + Math.random().toString(36).substring(2, 10),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => {
          const actions = [...s.actions, newAction];
          const streamProfiles = s.currentProfileId
            ? s.streamProfiles.map((p) =>
                p.id === s.currentProfileId
                  ? { ...p, actions, updatedAt: now }
                  : p
              )
            : s.streamProfiles;
          const profile = streamProfiles.find((p) => p.id === s.currentProfileId);
          console.log("[RUNTIME-ACTION-1]", JSON.stringify({
            actionId: newAction.id,
            actionName: newAction.name,
            currentProfileId: s.currentProfileId,
            zustandActionsCount: actions.length,
            currentProfileActionsLength: profile?.actions?.length ?? 0,
            streamProfilesCount: streamProfiles.length,
          }));
          return { actions, streamProfiles };
        });
        // Queue cloud profile update so refresh/restart does not lose the action
        if (!get()._isRehydrating) {
          const { currentProfileId, actions } = get();
          const profile = get().streamProfiles.find((p) => p.id === currentProfileId);
          if (profile) {
            import("./auth-store").then(({ useAuthStore }) => {
              const authUserId = useAuthStore.getState().currentUser?.id;
              if (!authUserId) return;
              import("../services/profile-sync-queue").then(({ profileSyncQueue }) => {
                profileSyncQueue.enqueue(authUserId, "update", profile.id, profile.serverId, {
                  actions: actions as any,
                });
                import("../services/profile-sync-processor").then(({ profileSyncProcessor }) => {
                  profileSyncProcessor.trigger(authUserId);
                });
              });
            }).catch(() => {});
          }
        }
      },
      /**
       * ACTION PACK IMPORT ONLY.
       *
       * Contract:
       * - Use explicit targetProfileId captured when import started
       *   (before async media restore). Falls back to live currentProfileId.
       * - Dual-write imported Actions into THAT target profile only
       * - NEVER addProfile / switchProfile / replaceProfiles / pullCloudProfiles
       *   / applyProfileImport / importProfilesByName / cloud enqueue
       * - NEVER change currentProfileId
       * - NEVER change streamProfiles length
       * - If anything else mutates currentProfileId during import, restore target
       */
      importActionsToCurrentProfile: async (importedActions, explicitTargetProfileId) => {
        const before = get();
        const targetProfileId =
          explicitTargetProfileId !== undefined
            ? explicitTargetProfileId
            : before.currentProfileId;
        const profileCountBefore = before.streamProfiles.length;
        const targetProfileName =
          before.streamProfiles.find((p) => p.id === targetProfileId)?.name ?? null;

        console.log("[ACTION-PACK-IMPORT-START]", JSON.stringify({
          currentProfileId: before.currentProfileId,
          currentProfileName:
            before.streamProfiles.find((p) => p.id === before.currentProfileId)?.name ?? null,
          importedActionCount: importedActions.length,
          profileCountBefore,
        }));
        console.log("[ACTION-PACK-IMPORT-TARGET]", JSON.stringify({
          targetProfileId,
          targetProfileName,
          explicitTarget: explicitTargetProfileId !== undefined,
        }));

        if (!targetProfileId) {
          console.warn("[ACTION-PACK-IMPORT-PROFILE-MUTATION]", JSON.stringify({
            operation: "skipped-no-current-profile",
            beforeCurrentProfileId: targetProfileId,
            afterCurrentProfileId: get().currentProfileId,
            profileCountBefore,
            profileCountAfter: get().streamProfiles.length,
          }));
          console.log("[ACTION-PACK-IMPORT-COMPLETE]", JSON.stringify({
            targetProfileId,
            finalCurrentProfileId: get().currentProfileId,
            importedActionCount: 0,
            restoredMediaCount: 0,
          }));
          return {
            targetProfileId,
            finalCurrentProfileId: get().currentProfileId,
            importedActionCount: 0,
            profileCountBefore,
            profileCountAfter: get().streamProfiles.length,
          };
        }

        const now = new Date().toISOString();
        const minted: Action[] = importedActions.map((a) => ({
          ...a,
          id: a.id || "act_" + Math.random().toString(36).substring(2, 10),
          createdAt: a.createdAt || now,
          updatedAt: now,
        }));

        // Snapshot profile identities so we can detect illegal mutations
        const profileIdsBefore = before.streamProfiles.map((p) => p.id);

        // ALWAYS write to the explicit target — never "whatever is current now".
        set((s) => {
          const topActions = [...s.actions, ...minted];
          const streamProfiles = s.streamProfiles.map((p) =>
            p.id === targetProfileId
              ? { ...p, actions: [...(p.actions ?? []), ...minted], updatedAt: now }
              : p,
          );
          return { actions: topActions, streamProfiles };
        });

        // Defense-in-depth: if currentProfileId was altered, force it back to target
        const mid = get();
        if (mid.currentProfileId !== targetProfileId) {
          console.log("[ACTION-PACK-IMPORT-PROFILE-MUTATION]", JSON.stringify({
            operation: "restore-currentProfileId",
            beforeCurrentProfileId: targetProfileId,
            afterCurrentProfileId: mid.currentProfileId,
            profileCountBefore,
            profileCountAfter: mid.streamProfiles.length,
          }));
          set({ currentProfileId: targetProfileId });
        }

        // Defense-in-depth: profile count / identity must not change
        const after = get();
        if (after.streamProfiles.length !== profileCountBefore) {
          console.warn("[ACTION-PACK-IMPORT-PROFILE-MUTATION]", JSON.stringify({
            operation: "profile-count-changed",
            beforeCurrentProfileId: targetProfileId,
            afterCurrentProfileId: after.currentProfileId,
            profileCountBefore,
            profileCountAfter: after.streamProfiles.length,
          }));
        }
        const profileIdsAfter = after.streamProfiles.map((p) => p.id);
        const idsChanged =
          profileIdsAfter.length !== profileIdsBefore.length ||
          profileIdsAfter.some((id, i) => id !== profileIdsBefore[i]);
        if (idsChanged) {
          console.warn("[ACTION-PACK-IMPORT-PROFILE-MUTATION]", JSON.stringify({
            operation: "profile-identity-changed",
            beforeCurrentProfileId: targetProfileId,
            afterCurrentProfileId: get().currentProfileId,
            profileCountBefore,
            profileCountAfter: get().streamProfiles.length,
            profileIdsBefore,
            profileIdsAfter,
          }));
        }

        // CRITICAL ASSERTION: final currentProfileId === target, profile count unchanged
        const finalState = get();
        if (finalState.currentProfileId !== targetProfileId) {
          console.error("[ACTION-PACK-IMPORT-ASSERT]", JSON.stringify({
            ok: false,
            reason: "finalCurrentProfileId !== targetProfileId",
            targetProfileId,
            finalCurrentProfileId: finalState.currentProfileId,
          }));
        } else if (finalState.streamProfiles.length !== profileCountBefore) {
          console.error("[ACTION-PACK-IMPORT-ASSERT]", JSON.stringify({
            ok: false,
            reason: "profileCountAfter !== profileCountBefore",
            profileCountBefore,
            profileCountAfter: finalState.streamProfiles.length,
          }));
        } else {
          console.log("[ACTION-PACK-IMPORT-ASSERT]", JSON.stringify({
            ok: true,
            targetProfileId,
            finalCurrentProfileId: finalState.currentProfileId,
            profileCountBefore,
            profileCountAfter: finalState.streamProfiles.length,
          }));
        }

        // NO cloud enqueue / pullCloudProfiles / processor trigger from this path.
        // Cloud profile sync can replace local profile IDs and switch currentProfileId.

        console.log("[ACTION-PACK-IMPORT-COMPLETE]", JSON.stringify({
          targetProfileId,
          finalCurrentProfileId: finalState.currentProfileId,
          importedActionCount: minted.length,
          restoredMediaCount: 0,
          profileCountBefore,
          profileCountAfter: finalState.streamProfiles.length,
        }));

        return {
          targetProfileId,
          finalCurrentProfileId: finalState.currentProfileId,
          importedActionCount: minted.length,
          profileCountBefore,
          profileCountAfter: finalState.streamProfiles.length,
        };
      },
      updateAction: async (id, action) => {
        set((s) => {
          const actions = s.actions.map((a) =>
            a.id === id ? { ...a, ...action, updatedAt: new Date().toISOString() } : a
          );
          const streamProfiles = s.currentProfileId
            ? s.streamProfiles.map((p) =>
                p.id === s.currentProfileId ? { ...p, actions } : p
              )
            : s.streamProfiles;
          return { actions, streamProfiles };
        });
      },
      deleteAction: (id) =>
        set((s) => {
          const actions = s.actions.filter((a) => a.id !== id);
          const streamProfiles = s.currentProfileId
            ? s.streamProfiles.map((p) =>
                p.id === s.currentProfileId ? { ...p, actions } : p
              )
            : s.streamProfiles;
          return { actions, streamProfiles };
        }),
      duplicateAction: (id) => {
        const action = get().actions.find((a) => a.id === id);
        if (action) {
          const now = new Date().toISOString();
          const copy: Action = {
            ...action,
            id: "act_" + Math.random().toString(36).substring(2, 10),
            name: action.name + " Copy",
            createdAt: now,
            updatedAt: now,
          };
          set((s) => {
            const actions = [...s.actions, copy];
            const streamProfiles = s.currentProfileId
              ? s.streamProfiles.map((p) =>
                  p.id === s.currentProfileId ? { ...p, actions, updatedAt: now } : p
                )
              : s.streamProfiles;
            return { actions, streamProfiles };
          });
        }
      },

      // ══ Events CRUD ══════════════════════════════
      // Dual-write events to top-level + profile.events (same as Actions).
      addEvent: (event) => {
        const now = new Date().toISOString();
        const newEvent: Event = {
          ...event,
          id: "evt_" + Math.random().toString(36).substring(2, 10),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => {
          const events = [...s.events, newEvent];
          const streamProfiles = s.currentProfileId
            ? s.streamProfiles.map((p) =>
                p.id === s.currentProfileId ? { ...p, events, updatedAt: now } : p
              )
            : s.streamProfiles;
          const profile = streamProfiles.find((p) => p.id === s.currentProfileId);
          console.log("[RUNTIME-EVENT-1]", JSON.stringify({
            eventId: newEvent.id,
            eventName: newEvent.actionName,
            currentProfileId: s.currentProfileId,
            zustandEventsCount: events.length,
            currentProfileEventsLength: profile?.events?.length ?? 0,
            streamProfilesCount: streamProfiles.length,
          }));
          return { events, streamProfiles };
        });
      },
      updateEvent: (id, event) =>
        set((s) => {
          const events = s.events.map((e) =>
            e.id === id ? { ...e, ...event, updatedAt: new Date().toISOString() } : e
          );
          const streamProfiles = s.currentProfileId
            ? s.streamProfiles.map((p) =>
                p.id === s.currentProfileId ? { ...p, events } : p
              )
            : s.streamProfiles;
          return { events, streamProfiles };
        }),
      deleteEvent: (id) =>
        set((s) => {
          const events = s.events.filter((e) => e.id !== id);
          const streamProfiles = s.currentProfileId
            ? s.streamProfiles.map((p) =>
                p.id === s.currentProfileId ? { ...p, events } : p
              )
            : s.streamProfiles;
          return { events, streamProfiles };
        }),

      // ══ Sounds CRUD ══════════════════════════════
      addImportedSound: (sound) => set((s) => ({
        customSounds: [...s.customSounds.filter((item) => item.id !== sound.id), sound],
      })),
      addSound: (sound) => {
        const { currentProfileId } = get();
        if (!currentProfileId) {
          console.warn('[SOUNDS] No current profile, cannot add sound');
          return;
        }
        const newSound: CustomSound = { ...sound, id: "snd_" + Math.random().toString(36).substring(2, 10), createdAt: new Date().toISOString(), profileId: currentProfileId };
        set((s) => ({ customSounds: [...s.customSounds, newSound] }));
      },
      deleteSound: (id) => {
        const { currentProfileId } = get();
        set((s) => ({
          customSounds: s.customSounds.filter((snd) => snd.id !== id || snd.profileId !== currentProfileId)
        }));
      },
      updateSound: (id, updates) => {
        const { currentProfileId } = get();
        set((s) => ({
          customSounds: s.customSounds.map((snd) => (snd.id === id && snd.profileId === currentProfileId ? { ...snd, ...updates } : snd)),
        }));
      },
      // Get custom sounds for a specific profile
      getCustomSoundsByProfile: (profileId: string) => {
        const { customSounds } = get();
        return customSounds.filter(snd => snd.profileId === profileId);
      },
      // Get custom sounds for current profile
      getCurrentProfileCustomSounds: () => {
        const { customSounds, currentProfileId } = get();
        if (!currentProfileId) return [];
        return customSounds.filter(snd => snd.profileId === currentProfileId);
      },

      // ══ Stats (deprecated wrappers → screen-0) ════════════════════════════════
      setStats: (stats) => get().setScreenStats("screen-0", stats),
      incrementStat: (key, value = 1) => get().incrementScreenStat("screen-0", key, value),

      // ══ Connection (deprecated wrappers → screen-0) ═══════════════════════════════
      setConnected: (username) => get().setScreenConnected("screen-0", username),
      setDisconnected: () => get().setScreenDisconnected("screen-0"),

      // ══ Gifts ════════════════════════════════════
      setTikTokGifts: (gifts) => set({ tikTokGifts: gifts }),

      // ══ License ══════════════════════════════════
      setLicenseInfo: (info) => set((s) => ({ licenseInfo: { ...s.licenseInfo, ...info } })),

      // ══ Setup Config ═════════════════════════════
      updateSetupConfig: (config) => set((s) => {
        const newSetupConfig = { ...s.setupConfig, ...config };
        // If overlayScreensMaxQueue changed, update action-queue cache
        if (config.overlayScreensMaxQueue) {
          try {
            const { updateMaxQueueLength } = require('../lib/action-queue');
            for (const [screenId, maxQueue] of Object.entries(config.overlayScreensMaxQueue)) {
              updateMaxQueueLength(screenId, maxQueue);
            }
          } catch {}
        }
        return { setupConfig: newSetupConfig };
      }),

      // ══ Stream Profiles ══════════════════════════
      _isRehydrating: true,
      _setRehydrating: (v) => set({ _isRehydrating: v }),

      replaceProfiles: (profiles) => {
        const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        const currentProfileId = get().currentProfileId;
        const { profiles: lockedProfiles } = calculateProfileLockState(profiles, currentProfileId, maxProfiles);
        // Preserve currentProfileId when the profile still exists after replace.
        const prevId = get().currentProfileId;
        const nextProfileId =
          prevId && lockedProfiles.some((p) => p.id === prevId)
            ? prevId
            : lockedProfiles.length > 0
              ? lockedProfiles[0].id
              : null;
        set({
          streamProfiles: lockedProfiles,
          currentProfileId: nextProfileId,
        });
      },

      // V3: Apply portable profile configuration to the CURRENTLY ACTIVE profile
      applyProfileImport: (profileConfig: Record<string, unknown>) => {
        // [PROFILE-IMPORT-1] Before import
        const beforeMaxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        const beforeCurrentProfileId = get().currentProfileId;
        const beforeCurrentProfile = get().streamProfiles.find(p => p.id === beforeCurrentProfileId);
        console.log("[PROFILE-IMPORT-1]", JSON.stringify({
          currentProfileId: beforeCurrentProfileId,
          currentProfileName: beforeCurrentProfile?.name,
          existingProfilesCount: get().streamProfiles.length,
          existingProfiles: get().streamProfiles.map(p => ({ id: p.id, name: p.name, locked: p.locked })),
          maxProfiles: beforeMaxProfiles,
          importType: "applyProfileImport (V3 portable)",
        }));

        const { currentProfileId, alertSettings, setupConfig } = get();
        if (!currentProfileId) {
          console.warn('[IMPORT] No active profile to import into');
          return;
        }

        const prevProfiles = get().streamProfiles;
        const targetIdx = prevProfiles.findIndex(p => p.id === currentProfileId);
        if (targetIdx < 0) {
          console.warn('[IMPORT] Active profile not found:', currentProfileId);
          return;
        }

        const now = new Date().toISOString();
        const updated = [...prevProfiles];

        // Apply portable profile fields to the target profile (preserving id, createdAt, locked, serverId)
        // MERGE actions/events by id — import must not delete existing local actions.
        const prevActions = updated[targetIdx].actions ?? [];
        const impActions = (profileConfig.actions as Action[]) ?? [];
        // Order-preserving merge by id
        const impActionById = new Map(impActions.filter((a) => a?.id).map((a) => [a.id, a]));
        const seenAct = new Set<string>();
        const mergedActions: Action[] = [];
        for (const a of prevActions) {
          if (a?.id && impActionById.has(a.id)) {
            mergedActions.push(impActionById.get(a.id)!);
            seenAct.add(a.id);
          } else if (a) mergedActions.push(a);
        }
        for (const a of impActions) {
          if (a?.id) {
            if (!seenAct.has(a.id)) {
              mergedActions.push(a);
              seenAct.add(a.id);
            }
          } else if (a) mergedActions.push(a);
        }
        const prevEvents = updated[targetIdx].events ?? [];
        const impEvents = (profileConfig.events as Event[]) ?? [];
        const impEventById = new Map(impEvents.filter((e) => e?.id).map((e) => [e.id, e]));
        const seenEvt = new Set<string>();
        const mergedEvents: Event[] = [];
        for (const e of prevEvents) {
          if (e?.id && impEventById.has(e.id)) {
            mergedEvents.push(impEventById.get(e.id)!);
            seenEvt.add(e.id);
          } else if (e) mergedEvents.push(e);
        }
        for (const e of impEvents) {
          if (e?.id) {
            if (!seenEvt.has(e.id)) {
              mergedEvents.push(e);
              seenEvt.add(e.id);
            }
          } else if (e) mergedEvents.push(e);
        }
        console.log("[ActionImport]", JSON.stringify({
          importedCount: impActions.length,
          normalizedCount: impActions.length,
          persistedCount: mergedActions.length,
          existingCount: prevActions.length,
          finalCount: mergedActions.length,
          path: "applyProfileImport",
        }));
        updated[targetIdx] = {
          ...updated[targetIdx],
          // Portable imports apply configuration to the destination; identity stays local.
          name: updated[targetIdx].name,
          icon: (profileConfig.icon as string) ?? updated[targetIdx].icon,
          tiktokUsername: (profileConfig.tiktokUsername as string) ?? updated[targetIdx].tiktokUsername,
          overlaySettings: (profileConfig.overlaySettings as Record<string, unknown>) ?? updated[targetIdx].overlaySettings,
          alertsSettings: (profileConfig.alertsSettings as Record<string, unknown>) ?? updated[targetIdx].alertsSettings,
          alertsMasterEnabled: (profileConfig.alertsMasterEnabled as boolean) ?? updated[targetIdx].alertsMasterEnabled,
          ttsSettings: (profileConfig.ttsSettings as any) ?? updated[targetIdx].ttsSettings,
          actions: mergedActions,
          events: mergedEvents,
          customSounds: (profileConfig.customSounds as any[]) ?? updated[targetIdx].customSounds,
          updatedAt: now,
        };

        const targetProfile = updated[targetIdx];

        // [PROFILE-IMPORT-2] Immediately after imported profiles are parsed
        console.log("[PROFILE-IMPORT-2]", JSON.stringify({
          importedProfilesCount: 1,
          importedProfiles: [{ id: targetProfile.id, name: targetProfile.name, locked: targetProfile.locked }],
          updatedProfilesCount: updated.length,
          updatedProfiles: updated.map(p => ({ id: p.id, name: p.name, locked: p.locked })),
          importType: "applyProfileImport (V3 portable)",
        }));

        // Recalculate lock state using central helper
        const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        const activeProfileId = get().currentProfileId;
        const { profiles: lockedProfiles } = calculateProfileLockState(updated, activeProfileId, maxProfiles);

        // [PROFILE-IMPORT-3] Immediately before replaceProfiles / final profile write
        console.log("[PROFILE-IMPORT-3]", JSON.stringify({
          mergedProfilesCount: lockedProfiles.length,
          profiles: lockedProfiles.map(p => ({ id: p.id, name: p.name, locked: p.locked })),
          currentProfileId: activeProfileId,
          maxProfiles,
          importType: "applyProfileImport (V3 portable)",
        }));

        // Sync the target profile's actions/events/alerts into top-level state
        set({
          streamProfiles: lockedProfiles,
          actions: targetProfile.actions || [],
          events: targetProfile.events || [],
          alertSettings: targetProfile.alertsSettings || alertSettings,
          setupConfig: { ...setupConfig, tikTokName: targetProfile.tiktokUsername || "" },
        });

        // [PROFILE-IMPORT-4] Immediately after import completes
        const newState = get();
        console.log("[PROFILE-IMPORT-4]", JSON.stringify({
          finalProfiles: newState.streamProfiles.map(p => ({ id: p.id, name: p.name, locked: p.locked })),
          currentProfileId: newState.currentProfileId,
          currentProfileName: newState.streamProfiles.find(p => p.id === newState.currentProfileId)?.name,
          importType: "applyProfileImport (V3 portable)",
        }));

        // [PROFILE-IMPORT-PROFILE-ID] Profile ID tracking
        console.log("[PROFILE-IMPORT-PROFILE-ID]", JSON.stringify({
          beforeImportCurrentProfileId,
          beforeImportCurrentProfileName: beforeCurrentProfile?.name,
          afterImportCurrentProfileId: newState.currentProfileId,
          afterImportCurrentProfileName: newState.streamProfiles.find(p => p.id === newState.currentProfileId)?.name,
          importType: "applyProfileImport (V3 portable)",
        }));
      },

      // V2/V1: Import all profiles by name matching (legacy)
      importProfilesByName: (importedProfiles) => {
        // [PROFILE-IMPORT-1] Before import
        const beforeMaxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        const beforeCurrentProfileId = get().currentProfileId;
        const beforeCurrentProfile = get().streamProfiles.find(p => p.id === beforeCurrentProfileId);
        console.log("[PROFILE-IMPORT-1]", JSON.stringify({
          currentProfileId: beforeCurrentProfileId,
          currentProfileName: beforeCurrentProfile?.name,
          existingProfilesCount: get().streamProfiles.length,
          existingProfiles: get().streamProfiles.map(p => ({ id: p.id, name: p.name, locked: p.locked })),
          maxProfiles: beforeMaxProfiles,
        }));

        const maxProfiles = beforeMaxProfiles;
        const prevProfiles = get().streamProfiles;
        const updated = [...prevProfiles];

        // Capture top-level state BEFORE update (for active profile sync)
        // NOTE: actions/events are NOT captured here — they would be stale pre-import
        // arrays. The sync step below reads directly from the updated profile instead.
        const { currentProfileId, alertSettings, setupConfig } = get();

        for (const imported of importedProfiles) {
          const existingIdx = updated.findIndex(p => p.name === imported.name);
          const now = new Date().toISOString();

          // [REAL-IMPORT-ACTIONS-MATCH] Import profile match diagnostics
          console.log('[REAL-IMPORT-ACTIONS-MATCH]', JSON.stringify({
            importedProfileName: imported.name,
            existingProfileId: existingIdx >= 0 ? updated[existingIdx].id : 'NEW',
            importedActionCount: imported.actions?.length ?? 0,
            importedActionIds: imported.actions?.map((a: Action) => a.id) ?? [],
          }));

          if (existingIdx >= 0) {
            // Update existing profile by name match.
            // MERGE actions/events by id — do not wipe local actions on import.
            // Expected: existing A,B + import C,D → A,B,C,D
            const existingActions = updated[existingIdx].actions ?? [];
            const importedActions = imported.actions ?? [];
            // Order-preserving merge: keep existing order, replace by id, append new
            const importedById = new Map(
              importedActions.filter((a: Action) => a?.id).map((a: Action) => [a.id, a])
            );
            const seenActionIds = new Set<string>();
            const mergedActions: Action[] = [];
            for (const a of existingActions) {
              if (a?.id && importedById.has(a.id)) {
                mergedActions.push(importedById.get(a.id)!);
                seenActionIds.add(a.id);
              } else if (a) {
                mergedActions.push(a);
              }
            }
            for (const a of importedActions) {
              if (a?.id) {
                if (!seenActionIds.has(a.id)) {
                  mergedActions.push(a);
                  seenActionIds.add(a.id);
                }
              } else if (a) {
                mergedActions.push(a);
              }
            }
            const existingEvents = updated[existingIdx].events ?? [];
            const importedEvents = imported.events ?? [];
            const importedEventsById = new Map(
              importedEvents.filter((e: Event) => e?.id).map((e: Event) => [e.id, e])
            );
            const seenEventIds = new Set<string>();
            const mergedEvents: Event[] = [];
            for (const e of existingEvents) {
              if (e?.id && importedEventsById.has(e.id)) {
                mergedEvents.push(importedEventsById.get(e.id)!);
                seenEventIds.add(e.id);
              } else if (e) {
                mergedEvents.push(e);
              }
            }
            for (const e of importedEvents) {
              if (e?.id) {
                if (!seenEventIds.has(e.id)) {
                  mergedEvents.push(e);
                  seenEventIds.add(e.id);
                }
              } else if (e) {
                mergedEvents.push(e);
              }
            }
            console.log("[ActionImport]", JSON.stringify({
              importedCount: importedActions.length,
              normalizedCount: importedActions.length,
              persistedCount: mergedActions.length,
              existingCount: existingActions.length,
              finalCount: mergedActions.length,
              profileName: imported.name,
            }));
            updated[existingIdx] = {
              ...updated[existingIdx],
              icon: imported.icon,
              tiktokUsername: imported.tiktokUsername,
              alertsMasterEnabled: imported.alertsMasterEnabled,
              alertsSettings: imported.alertsSettings,
              ttsSettings: imported.ttsSettings,
              actions: mergedActions,
              events: mergedEvents,
              customSounds: imported.customSounds,
              overlaySettings: imported.overlaySettings,
              updatedAt: now,
            };
          } else {
            // Create new profile
            const newProfile: StreamProfile = {
              id: 'spf_' + Math.random().toString(36).substring(2, 10),
              name: imported.name,
              icon: imported.icon,
              tiktokUsername: imported.tiktokUsername,
              alertsMasterEnabled: imported.alertsMasterEnabled ?? true,
              alertsSettings: imported.alertsSettings ?? {},
              ttsSettings: imported.ttsSettings,
              actions: imported.actions ?? [],
              events: imported.events ?? [],
              customSounds: imported.customSounds ?? [],
              overlaySettings: imported.overlaySettings ?? {},
              locked: false, // Will be recalculated below
              createdAt: now,
              updatedAt: now,
            };
            updated.push(newProfile);
          }
        }

        // [PROFILE-IMPORT-2] Immediately after imported profiles are parsed
        console.log("[PROFILE-IMPORT-2]", JSON.stringify({
          importedProfilesCount: importedProfiles.length,
          importedProfiles: importedProfiles.map(p => ({ id: p.id, name: p.name, locked: p.locked })),
          updatedProfilesCount: updated.length,
          updatedProfiles: updated.map(p => ({ id: p.id, name: p.name, locked: p.locked })),
        }));

        // Recalculate lock state for all profiles using central helper
        const activeProfileId = get().currentProfileId;
        const { profiles: lockedProfiles } = calculateProfileLockState(updated, activeProfileId, maxProfiles);

        // [PROFILE-IMPORT-3] Immediately before replaceProfiles / final profile write
        console.log("[PROFILE-IMPORT-3]", JSON.stringify({
          mergedProfilesCount: lockedProfiles.length,
          profiles: lockedProfiles.map(p => ({ id: p.id, name: p.name, locked: p.locked })),
          currentProfileId: activeProfileId,
          maxProfiles,
        }));

        // Sync the active profile's data into top-level state so the UI
        // immediately reflects imported actions/events/alerts/tiktokUsername.
        // Mirrors the synchronization pattern used by switchProfile().
        if (currentProfileId) {
          const activeProfile = updated.find(p => p.id === currentProfileId);
          if (activeProfile) {
            // Propagate the imported profile's data into top-level state so the UI
            // immediately reflects imported actions/events/alerts/tiktokUsername.
            // Uses the UPDATED profile object (not stale pre-import captures).
            const syncedProfiles = lockedProfiles.map(p => {
              if (p.id === currentProfileId) {
                return {
                  ...p,
                  // Use imported profile data, not stale pre-import captures
                  alertsSettings: activeProfile.alertsSettings ?? alertSettings,
                  alertsMasterEnabled: activeProfile.alertsMasterEnabled,
                  tiktokUsername: activeProfile.tiktokUsername ?? setupConfig.tikTokName,
                  updatedAt: new Date().toISOString(),
                };
              }
              return p;
            });

            const refreshed = syncedProfiles.find(p => p.id === currentProfileId)!;

            set({
              streamProfiles: syncedProfiles,
              actions: refreshed.actions || [],
              events: refreshed.events || [],
              alertSettings: refreshed.alertSettings || DEFAULT_ALERTS,
              setupConfig: { ...setupConfig, tikTokName: refreshed.tiktokUsername || "" },
            });

            // [REAL-IMPORT-ACTIONS-AFTER] Post-import profile actions
            console.log('[REAL-IMPORT-ACTIONS-AFTER]', JSON.stringify({
              profiles: syncedProfiles.map(p => ({
                profileId: p.id,
                profileName: p.name,
                actionCount: p.actions?.length ?? 0,
                actionIds: p.actions?.map((a: Action) => a.id) ?? [],
              })),
            }));

            // [PROFILE-IMPORT-4] Immediately after import completes
            console.log("[PROFILE-IMPORT-4]", JSON.stringify({
              finalProfiles: syncedProfiles.map(p => ({ id: p.id, name: p.name, locked: p.locked })),
              currentProfileId: get().currentProfileId,
              currentProfileName: syncedProfiles.find(p => p.id === get().currentProfileId)?.name,
            }));

            // [PROFILE-IMPORT-PROFILE-ID] Profile ID tracking
            console.log("[PROFILE-IMPORT-PROFILE-ID]", JSON.stringify({
              beforeImportCurrentProfileId,
              beforeImportCurrentProfileName: beforeCurrentProfile?.name,
              afterImportCurrentProfileId: get().currentProfileId,
              afterImportCurrentProfileName: syncedProfiles.find(p => p.id === get().currentProfileId)?.name,
            }));
            return;
          }
        }

        // [PROFILE-IMPORT-4] Immediately after import completes (fallback path)
        console.log("[PROFILE-IMPORT-4]", JSON.stringify({
          finalProfiles: lockedProfiles.map(p => ({ id: p.id, name: p.name, locked: p.locked })),
          currentProfileId: get().currentProfileId,
          currentProfileName: lockedProfiles.find(p => p.id === get().currentProfileId)?.name,
        }));

        // [PROFILE-IMPORT-PROFILE-ID] Profile ID tracking (fallback path)
        console.log("[PROFILE-IMPORT-PROFILE-ID]", JSON.stringify({
          beforeImportCurrentProfileId,
          beforeImportCurrentProfileName: beforeCurrentProfile?.name,
          afterImportCurrentProfileId: get().currentProfileId,
          afterImportCurrentProfileName: lockedProfiles.find(p => p.id === get().currentProfileId)?.name,
        }));

        set({ streamProfiles: lockedProfiles });
      },

      pullCloudProfiles: async (userId: string) => {
        const state = get();
        if (state._isRehydrating) return;

        try {
          const { fetchProfiles } = await import('../services/profile-api');
          const result = await fetchProfiles();

          const cloudProfiles: StreamProfile[] = result.profiles.map((p) => ({
            id: p.id,
            serverId: p.id,
            name: p.name,
            icon: p.icon ?? undefined,
            tiktokUsername: p.tiktokUsername,
            overlaySettings: p.overlaySettings,
            alertsSettings: p.alertsSettings,
            alertsMasterEnabled: p.alertsMasterEnabled ?? true,
            actions: Array.isArray(p.actions) ? (p.actions as unknown as Action[]) : [],
            events: Array.isArray(p.events) ? (p.events as unknown as Event[]) : [],
            customSounds: Array.isArray(p.customSounds) ? (p.customSounds as unknown as CustomSound[]) : [],
            ttsSettings: p.ttsSettings,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          }));

          // Protect pending local changes: get profile IDs with pending queue items
          const { profileSyncQueue } = await import('../services/profile-sync-queue');
          const pendingLocalIds = await profileSyncQueue.getPendingLocalIds(userId);

          // Merge: cloud profiles + local-only profiles (not in cloud, not pending)
          // Reconcile by HUMAN IDENTITY (name), not technical ID.
          // Default profiles use hardcoded IDs (profile-1..10) while cloud profiles
          // use server UUIDs. Matching by name prevents duplicate "Stream Profile N" entries.
          const localProfiles = state.streamProfiles;

          // Build cloud name map for O(1) lookup
          const cloudNameToProfile = new Map<string, StreamProfile>();
          for (const cp of cloudProfiles) {
            cloudNameToProfile.set(cp.name.trim().toLowerCase(), cp);
          }

          // Profiles that exist locally but NOT in cloud (by name) and have no pending sync
          const localOnlyProfiles = localProfiles.filter(p => {
            const cloudMatch = cloudNameToProfile.get(p.name.trim().toLowerCase());
            return !cloudMatch && !pendingLocalIds.has(p.id);
          });

          // Profiles that exist locally AND have pending changes — keep local version
          // BUT if there's a cloud name match, we still keep the local (pending) version
          // and exclude the cloud profile for that name to avoid duplicates
          const pendingLocalProfiles = localProfiles.filter(p =>
            pendingLocalIds.has(p.id)
          );

          // Remove cloud profiles that have a pending local name match
          // (pending local wins over cloud)
          const pendingNames = new Set(
            pendingLocalProfiles.map(p => p.name.trim().toLowerCase())
          );
          // MERGE actions/events by id when a local profile matches a cloud profile
          // by name — cloud pull must not wipe local-only actions.
          const mergeById = <T extends { id?: string }>(existing: T[] | undefined, incoming: T[] | undefined): T[] => {
            const ex = existing ?? [];
            const inc = incoming ?? [];
            const incById = new Map(inc.filter((x) => x?.id).map((x) => [x.id as string, x]));
            const seen = new Set<string>();
            const out: T[] = [];
            for (const x of ex) {
              if (x?.id && incById.has(x.id)) {
                out.push(incById.get(x.id)!);
                seen.add(x.id);
              } else if (x) out.push(x);
            }
            for (const x of inc) {
              if (x?.id) {
                if (!seen.has(x.id)) {
                  out.push(x);
                  seen.add(x.id);
                }
              } else if (x) out.push(x);
            }
            return out;
          };
          const filteredCloudProfiles = cloudProfiles
            .filter(cp => !pendingNames.has(cp.name.trim().toLowerCase()))
            .map((cp) => {
              // Diagnostic: before matching — log every cloud profile
              console.log('[CLOUD-MERGE-DIAG-1]', JSON.stringify({
                marker: 'cloud profile before merge',
                cloudId: cp.id,
                cloudName: cp.name,
                cloudIsDefault: cp.isDefault
              }));
              const localByName = localProfiles.find(
                p => p.name.trim().toLowerCase() === cp.name.trim().toLowerCase()
              );
              if (!localByName) return cp;
              // Diagnostic: before merge — log both cloud and local
              console.log('[CLOUD-MERGE-DIAG-2]', JSON.stringify({
                marker: 'before merge by name',
                cloudId: cp.id,
                cloudName: cp.name,
                cloudIsDefault: cp.isDefault,
                localId: localByName.id,
                localName: localByName.name,
                localIsDefault: localByName.isDefault
              }));
              const mergedActions = mergeById(localByName.actions, cp.actions);
              const mergedEvents = mergeById(localByName.events, cp.events);
              if (
                mergedActions.length !== (cp.actions?.length ?? 0) ||
                mergedEvents.length !== (cp.events?.length ?? 0)
              ) {
                console.log("[ActionHydration]", JSON.stringify({
                  persistedCount: mergedActions.length,
                  hydratedCount: cp.actions?.length ?? 0,
                  profileId: cp.id,
                  profileName: cp.name,
                  localOnlyActionsPreserved: mergedActions.length - (cp.actions?.length ?? 0),
                }));
              }
              const merged = { ...cp, actions: mergedActions, events: mergedEvents, isDefault: localByName.isDefault };
              // Diagnostic: after merge — log merged result
              console.log('[CLOUD-MERGE-DIAG-3]', JSON.stringify({
                marker: 'after merge',
                mergedId: merged.id,
                mergedName: merged.name,
                mergedIsDefault: merged.isDefault
              }));
              return merged;
            });

          const mergedProfiles = [...filteredCloudProfiles, ...localOnlyProfiles, ...pendingLocalProfiles];

          // Diagnostic: log each merged profile before calculateProfileLockState
          for (const p of mergedProfiles) {
            console.log('[MERGED-PROFILE-DIAG]', JSON.stringify({
              marker: 'merged profile before lock calc',
              id: p.id,
              name: p.name,
              isDefault: p.isDefault,
              isDefaultProfileResult: isDefaultProfile(p),
              idStartsWithProfile: p.id.startsWith('profile-'),
              idStartsWithSpf: p.id.startsWith('spf_')
            }));
          }

          // Only apply locks if the license store is already initialized.
          // If not, set all profiles unlocked — the 'rosae:license-updated' event
          // will recalculate correct locks once entitlements are authoritative.
          const licenseInitialized = useLicenseStore.getState().isInitialized;
          const maxProfiles = licenseInitialized
            ? useLicenseStore.getState().getMaxStreamProfiles()
            : mergedProfiles.length;
          const preferredId = get().currentProfileId;
          const preferredLocal = localProfiles.find((p) => p.id === preferredId);
          // Diagnostic: before calculateProfileLockState
          console.log('[LOCK-CALC-DIAG]', JSON.stringify({
            marker: 'before calculateProfileLockState',
            mergedProfileCount: mergedProfiles.length,
            maxProfiles,
            profiles: mergedProfiles.map(p => ({
              id: p.id,
              name: p.name,
              isDefault: p.isDefault,
              isDefaultProfileResult: isDefaultProfile(p),
              idStartsWithProfile: p.id.startsWith('profile-'),
              idStartsWithSpf: p.id.startsWith('spf_')
            }))
          }));
          const { profiles: lockedProfiles } = calculateProfileLockState(mergedProfiles, preferredId, maxProfiles);

          // Sync the active profile's actions/events/alerts into top-level state
          // so the UI immediately reflects the correct data after cloud merge.
          // Prefer currentProfileId when it still exists after merge. If cloud
          // name-merge replaced the local id with a server UUID, remap by NAME
          // before falling back to lockedProfiles[0] (that fallback switched
          // Stream Profiles after Action Pack import / reload).
          const preferredName = preferredLocal?.name?.trim().toLowerCase() ?? null;
          let activeId = null;
          let activeResolution: "by-id" | "by-name" | "fallback-first" | "none" = "none";
          if (preferredId && lockedProfiles.some((p) => p.id === preferredId)) {
            activeId = preferredId;
            activeResolution = "by-id";
          } else if (preferredName) {
            const byName = lockedProfiles.find(
              (p) => p.name.trim().toLowerCase() === preferredName,
            );
            if (byName) {
              activeId = byName.id;
              activeResolution = "by-name";
            }
          }
          if (!activeId && lockedProfiles.length > 0) {
            activeId = lockedProfiles[0].id;
            activeResolution = "fallback-first";
          }
          const active = activeId ? lockedProfiles.find((p) => p.id === activeId) : null;

          console.log("[RUNTIME-POST-CLOUD]", JSON.stringify({
            cloudProfileCount: cloudProfiles.length,
            localProfileCount: localProfiles.length,
            mergedProfileCount: mergedProfiles.length,
            lockedProfileCount: lockedProfiles.length,
            preferredProfileId: preferredId,
            preferredProfileName: preferredLocal?.name ?? null,
            activeProfileId: activeId,
            activeResolution,
            localActionsCount: localProfiles.reduce((sum, p) => sum + (p.actions?.length ?? 0), 0),
            cloudActionsCount: cloudProfiles.reduce((sum, p) => sum + (p.actions?.length ?? 0), 0),
            mergedActionsCount: lockedProfiles.reduce((sum, p) => sum + (p.actions?.length ?? 0), 0),
            finalCurrentProfileId: activeId,
          }));

          set({
            streamProfiles: lockedProfiles,
            currentProfileId: activeId,
            ...(active ? {
              actions: active.actions || [],
              events: active.events || [],
              alertSettings: active.alertsSettings || DEFAULT_ALERTS,
              setupConfig: { ...get().setupConfig, tikTokName: active.tiktokUsername || "" },
            } : {}),
          });

        } catch (err) {
          console.warn('[APP-STORE] pullCloudProfiles failed:', err);
        }
      },

      migrateLocalProfilesToCloud: async (userId: string) => {
        const state = get();
        if (state._isRehydrating) return;

        const localProfiles = state.streamProfiles;
        if (localProfiles.length === 0) return;

        try {
          const { fetchProfiles, bulkUpsertProfiles } = await import('../services/profile-api');
          const result = await fetchProfiles();

          if (result.profiles.length > 0) {
            console.log('[APP-STORE] Cloud profiles exist, pulling instead of uploading');
            await get().pullCloudProfiles(userId);
            return;
          }

          // Only cap by maxProfiles when the license is initialized.
          // During the init race, maxProfiles defaults to 1 (free), which would
          // silently discard profiles 2-10. Upload all profiles and let the server
          // enforce limits on subsequent create/update calls.
          const licenseInitialized = useLicenseStore.getState().isInitialized;
          const profilesToUpload = licenseInitialized
            ? localProfiles.slice(0, useLicenseStore.getState().getMaxStreamProfiles())
            : localProfiles;

          if (profilesToUpload.length === 0) return;

          const bulkPayload = profilesToUpload.map((p, index) => ({
            name: p.name,
            icon: p.icon,
            tiktokUsername: p.tiktokUsername,
            overlaySettings: p.overlaySettings,
            alertsSettings: p.alertsSettings,
            alertsMasterEnabled: p.alertsMasterEnabled ?? true,
            actions: p.actions as unknown as Record<string, unknown>[],
            events: p.events as unknown as Record<string, unknown>[],
            customSounds: p.customSounds as unknown as Record<string, unknown>[],
            ttsSettings: p.ttsSettings,
            sortOrder: index,
          }));

          const bulkResult = await bulkUpsertProfiles(bulkPayload);

          if (bulkResult?.results) {
            const updatedProfiles = [...localProfiles];
            for (const serverResult of bulkResult.results) {
              const localIndex = updatedProfiles.findIndex(p => p.name === serverResult.name);
              if (localIndex >= 0) {
                updatedProfiles[localIndex] = {
                  ...updatedProfiles[localIndex],
                  serverId: serverResult.serverId,
                  id: serverResult.serverId,
                };
              }
            }

            const { profiles: lockedProfiles } = calculateProfileLockState(
              updatedProfiles,
              get().currentProfileId,
              useLicenseStore.getState().getMaxStreamProfiles(),
            );

            set({ streamProfiles: lockedProfiles });
          }

          console.log('[APP-STORE] Migrated', profilesToUpload.length, 'local profiles to cloud');
        } catch (err) {
          console.warn('[APP-STORE] Migration failed, keeping local profiles:', err);
        }
      },

      resetProfiles: () => {
        set({
          streamProfiles: [],
          currentProfileId: null,
          actions: [],
          events: [],
          alertSettings: DEFAULT_ALERTS,
        });
      },

      addProfile: (profile) => {
        const { streamProfiles, currentProfileId } = get();
        const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        // Check occupied slots instead of total count
        const { occupiedCount } = calculateProfileLockState(streamProfiles, currentProfileId, maxProfiles);
        if (occupiedCount >= maxProfiles) {
          console.warn(`[PROFILE-ENFORCEMENT] Cannot add profile: all ${maxProfiles} slots occupied`);
          return;
        }
        const now = new Date().toISOString();
        const newProfile: StreamProfile = { ...profile, id: "spf_" + Math.random().toString(36).substring(2, 10), locked: false, isDefault: false, alertsMasterEnabled: profile.alertsMasterEnabled ?? true, createdAt: now, updatedAt: now };
        set((s) => ({ streamProfiles: [...s.streamProfiles, newProfile] }));

        // Enqueue create operation (persistent, survives offline/restart)
        if (!get()._isRehydrating) {
          import('./auth-store').then(({ useAuthStore }) => {
            const authUserId = useAuthStore.getState().currentUser?.id;
            if (!authUserId) return;
            import('../services/profile-sync-queue').then(({ profileSyncQueue }) => {
              profileSyncQueue.enqueue(authUserId, 'create', newProfile.id, undefined, {
                name: newProfile.name,
                icon: newProfile.icon,
                tiktokUsername: newProfile.tiktokUsername,
                overlaySettings: newProfile.overlaySettings,
                alertsSettings: newProfile.alertsSettings,
                actions: newProfile.actions as any,
                events: newProfile.events as any,
                sortOrder: streamProfiles.length,
              });
              import('../services/profile-sync-processor').then(({ profileSyncProcessor }) => {
                profileSyncProcessor.trigger(authUserId);
              });
            });
          });
        }
      },

      updateProfile: (id, updates) => {
        set((s) => ({
          streamProfiles: s.streamProfiles.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p),
        }));

        // Enqueue update operation (persistent, survives offline/restart)
        if (!get()._isRehydrating) {
          const profile = get().streamProfiles.find(p => p.id === id);
          import('./auth-store').then(({ useAuthStore }) => {
            const authUserId = useAuthStore.getState().currentUser?.id;
            if (!authUserId) return;
            import('../services/profile-sync-queue').then(({ profileSyncQueue }) => {
              const payload: Record<string, unknown> = {};
              if (updates.name !== undefined) payload.name = updates.name;
              if (updates.icon !== undefined) payload.icon = updates.icon;
              if (updates.tiktokUsername !== undefined) payload.tiktokUsername = updates.tiktokUsername;
              if (updates.overlaySettings !== undefined) payload.overlaySettings = updates.overlaySettings;
              if (updates.alertsSettings !== undefined) payload.alertsSettings = updates.alertsSettings;
              if (updates.alertsMasterEnabled !== undefined) payload.alertsMasterEnabled = updates.alertsMasterEnabled;
              if (updates.actions !== undefined) payload.actions = updates.actions as any;
              if (updates.events !== undefined) payload.events = updates.events as any;
              if (updates.ttsSettings !== undefined) payload.ttsSettings = updates.ttsSettings;

              profileSyncQueue.enqueue(authUserId, 'update', id, profile?.serverId, payload);
              import('../services/profile-sync-processor').then(({ profileSyncProcessor }) => {
                profileSyncProcessor.trigger(authUserId);
              });
            });
          });
        }
      },

      deleteProfile: (id) => {
        const profile = get().streamProfiles.find(p => p.id === id);
        const deletedWasActive = get().currentProfileId === id;

        // Resolve authenticated userId for overlay cascade
        let authUserId: string | undefined;
        try {
          const authModule = require('./auth-store');
          authUserId = authModule?.useAuthStore?.getState?.()?.currentUser?.id;
        } catch {}

        // Cascade: delete associated overlays from Dexie + queue cloud tombstone
        if (authUserId) {
          import('../lib/db').then(({ deleteOverlaysByProfile }) => {
            deleteOverlaysByProfile(authUserId, id).then((deletedIds) => {
              // Queue cloud tombstone for each deleted overlay
              if (deletedIds.length > 0) {
                import('../services/sync/sync-engine').then(({ getSyncEngine }) => {
                  for (const overlayId of deletedIds) {
                    getSyncEngine().queueEntity('overlay', overlayId, 'delete', {}, 1).catch(() => {});
                  }
                }).catch(() => {});
              }
            }).catch(() => {});
          }).catch(() => {});
        }

        // Also delete associated custom sounds from Dexie
        import('../lib/db').then(({ deleteSoundsByProfile }) => {
          deleteSoundsByProfile(id).catch(() => {});
        });

        // Remove profile from Zustand
        const remainingProfiles = get().streamProfiles.filter(p => p.id !== id);
        set((s) => ({ streamProfiles: remainingProfiles }));

        // If deleted profile was active, switch to first remaining profile
        if (deletedWasActive) {
          const newProfileId = remainingProfiles.length > 0 ? remainingProfiles[0].id : null;
          if (newProfileId) {
            get().switchProfile(newProfileId);
          } else {
            // No profiles remain — reset to defaults
            set({ currentProfileId: null, actions: [], events: [], alertSettings: {} });
          }
        }

        // Enqueue profile deletion to cloud sync queue
        if (!get()._isRehydrating) {
          import('./auth-store').then(({ useAuthStore }) => {
            const userId = useAuthStore.getState().currentUser?.id;
            if (!userId) return;
            import('../services/profile-sync-queue').then(({ profileSyncQueue }) => {
              profileSyncQueue.enqueue(userId, 'delete', id, profile?.serverId);
              import('../services/profile-sync-processor').then(({ profileSyncProcessor }) => {
                profileSyncProcessor.trigger(userId);
              });
            });
          });
        }
      },

      setCurrentProfile: (id) => set({ currentProfileId: id }),
      switchProfile: (targetId: string) => {
        const { streamProfiles, currentProfileId, actions, events, alertSettings, setupConfig, customSounds } = get();
        if (targetId === currentProfileId) return;

        // Entitlement check: defense-in-depth - use central helper for lock state
        const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        const { profiles: lockedProfiles } = calculateProfileLockState(streamProfiles, currentProfileId, maxProfiles);
        const targetProfile = lockedProfiles.find(p => p.id === targetId);
        if (!targetProfile) {
          console.warn(`[PROFILE-ENFORCEMENT] Profile not found: ${targetId}`);
          return;
        }
        if (targetProfile.locked) {
          console.warn(`[PROFILE-ENFORCEMENT] Profile is locked: ${targetId}`);
          return;
        }

        // Capture previous profile snapshot BEFORE state update
        // (actions/events/alerts/tiktokUsername/customSounds are from active state, not from streamProfiles array)
        const previousProfile = streamProfiles.find(p => p.id === currentProfileId);
        const previousServerId = previousProfile?.serverId;
        const previousSnapshot = {
          actions,
          events,
          alertsSettings: alertSettings,
          alertsMasterEnabled: previousProfile?.alertsMasterEnabled ?? true,
          tiktokUsername: setupConfig.tikTokName,
          customSounds: customSounds.filter(s => s.profileId === currentProfileId),
        };

        const updatedProfiles = streamProfiles.map(p => {
          if (p.id === currentProfileId) {
            return {
              ...p,
              ...previousSnapshot,
              updatedAt: new Date().toISOString(),
            };
          }
          return p;
        });

        const updatedTarget = updatedProfiles.find(p => p.id === targetId);
        if (!updatedTarget) return;

        set({
          streamProfiles: updatedProfiles,
          currentProfileId: targetId,
          actions: updatedTarget.actions || [],
          events: updatedTarget.events || [],
          alertSettings: updatedTarget.alertsSettings || DEFAULT_ALERTS,
          setupConfig: { ...setupConfig, tikTokName: updatedTarget.tiktokUsername || "" },
        });

        // Recalculate lock state after profile switch to ensure correct Pro/Free limits
        // This prevents stale locked values from persisting across profile switches
        const { profiles: recalculatedProfiles } = calculateProfileLockState(
          updatedProfiles,
          targetId,
          useLicenseStore.getState().getMaxStreamProfiles(),
        );
        // Only apply if the recalculated state differs from what we just set
        // (avoid unnecessary re-renders while still fixing the stale-lock bug)
        const hasDifference = recalculatedProfiles.some((p, i) => p.locked !== updatedProfiles[i].locked);
        if (hasDifference) {
          set({ streamProfiles: recalculatedProfiles });
        }

      // [REAL-SWITCH-ACTIONS] Profile switch action state
      console.log('[REAL-SWITCH-ACTIONS]', JSON.stringify({
          fromProfileId: currentProfileId,
          fromProfileName: previousProfile?.name ?? 'UNKNOWN',
          fromActionCount: actions.length,
          fromActionIds: actions.map((a: Action) => a.id),
          toProfileId: targetId,
          toProfileName: updatedTarget.name,
          resultingActionCount: updatedTarget.actions?.length ?? 0,
          resultingActionIds: updatedTarget.actions?.map((a: Action) => a.id) ?? [],
        }));

        // [FORENSIC-ACTIONS-PROFILE-SWITCH] Post-switch top-level state
        console.log('[FORENSIC-ACTIONS-PROFILE-SWITCH]', JSON.stringify({
          currentProfileId: targetId,
          topLevelActionCount: updatedTarget.actions?.length ?? 0,
          topLevelActionIds: updatedTarget.actions?.map((a: Action) => a.id) ?? [],
        }));

        // Dispatch profile change event for TTS and other listeners
        window.dispatchEvent(new CustomEvent('rosae:profile-changed', {
          detail: { profileId: targetId },
        }));

        // ── Overlay profile transition ──
        // Atomically switch overlay instances to target profile
        import('./auth-store').then(({ useAuthStore }) => {
          const authUserId = useAuthStore.getState().currentUser?.id;
          if (authUserId) {
            import('../lib/overlay-store').then(({ useOverlayStore }) => {
              useOverlayStore.getState().switchProfile(authUserId, targetId).catch((err) => {
                console.error('[PROFILE-SWITCH] Failed to switch overlay profile:', targetId, err);
              });
            }).catch(() => {});
          }
        }).catch(() => {});

        // Enqueue snapshot of previous profile (persistent, survives offline/restart)
        if (!get()._isRehydrating) {
          import('./auth-store').then(({ useAuthStore }) => {
            const authUserId = useAuthStore.getState().currentUser?.id;
            if (!authUserId) return;
            import('../services/profile-sync-queue').then(({ profileSyncQueue }) => {
              profileSyncQueue.enqueue(authUserId, 'update', currentProfileId!, previousServerId, {
                actions: previousSnapshot.actions as any,
                events: previousSnapshot.events as any,
                alertsSettings: previousSnapshot.alertsSettings,
                alertsMasterEnabled: previousSnapshot.alertsMasterEnabled,
                tiktokUsername: previousSnapshot.tiktokUsername,
                customSounds: previousSnapshot.customSounds,
              });
              import('../services/profile-sync-processor').then(({ profileSyncProcessor }) => {
                profileSyncProcessor.trigger(authUserId);
              });
            });
          });
        }
      },

      // ══ Live Events Feed (deprecated wrappers → screen-0) ═══════════════════
      addLiveEvent: (event) => get().addScreenLiveEvent("screen-0", { ...event, screenId: "screen-0" }),
      clearLiveEvents: () => get().clearScreenLiveEvents("screen-0"),

      // ══ Points System ════════════════════════════
      updatePointsConfig: (config) => set((s) => ({ pointsConfig: { ...s.pointsConfig, ...config } })),

      awardPoints: (type, username, nickname, count) => {
        const { pointsUsers, pointsConfig } = get();
        const key = username.toLowerCase().trim();
        if (!key) return;

        // Normalize count: must be a positive integer, defaults to 1
        const safeCount = Math.max(1, Math.floor(Number(count) || 1));

        const existing = pointsUsers[key];
        const user = existing
          ? { ...existing }
          : {
              username: key, name: nickname || username,
              points: 0, level: 1, giftCount: 0, likeCount: 0,
              followCount: 0, commentCount: 0, shareCount: 0,
              firstSeen: Date.now(), lastSeen: Date.now(),
            };

        let earned = 0;
        switch (type) {
          case "gift": earned = pointsConfig.pointsGift; break;
          case "like": earned = pointsConfig.pointsLike; break;
          case "follow": earned = pointsConfig.pointsFollow; break;
          case "comment": earned = pointsConfig.pointsComment; break;
          case "share": earned = pointsConfig.pointsShare; break;
          case "subscribe": earned = pointsConfig.pointsSubscribe; break;
        }

        user.points += earned * safeCount;
        user.lastSeen = Date.now();
        if (type === "gift") user.giftCount += safeCount;
        if (type === "like") user.likeCount += safeCount;
        if (type === "follow") user.followCount += safeCount;
        if (type === "comment") user.commentCount += safeCount;
        if (type === "share") user.shareCount += safeCount;
        user.level = calculateLevel(user.points, pointsConfig);

        set((s) => ({ pointsUsers: { ...s.pointsUsers, [key]: user } }));
      },

      deductPoints: (username, amount) => {
        const { pointsUsers, pointsConfig } = get();
        const key = username.toLowerCase().trim();
        const user = pointsUsers[key];
        if (!user || user.points < amount) return false;
        user.points -= amount;
        user.level = calculateLevel(user.points, pointsConfig);
        user.lastSeen = Date.now();
        set((s) => ({ pointsUsers: { ...s.pointsUsers, [key]: { ...user } } }));
        return true;
      },

      resetAllPoints: () => set((s) => {
        const updated: typeof s.pointsUsers = {};
        for (const [k, u] of Object.entries(s.pointsUsers)) {
          updated[k] = { ...u, points: 0, level: 1 };
        }
        return { pointsUsers: updated };
      }),

      halvePoints: (percent) => set((s) => {
        const ratio = Math.max(0, Math.min(100, percent)) / 100;
        const updated: typeof s.pointsUsers = {};
        for (const [k, u] of Object.entries(s.pointsUsers)) {
          const newPoints = Math.round(u.points * (1 - ratio));
          updated[k] = { ...u, points: newPoints, level: calculateLevel(newPoints, s.pointsConfig) };
        }
        return { pointsUsers: updated };
      }),

      // ══ Alert Settings ═══════════════════════════
      updateAlertSetting: (event, settings) => set((s) => ({
        alertSettings: { ...s.alertSettings, [event]: { ...s.alertSettings[event], ...settings } },
      })),
      getAlertsMasterEnabled: () => {
        const { streamProfiles, currentProfileId } = get();
        const profile = streamProfiles.find(p => p.id === currentProfileId);
        return profile?.alertsMasterEnabled ?? true;
      },
      setAlertsMasterEnabled: (enabled) => {
        const { streamProfiles, currentProfileId } = get();
        const profile = streamProfiles.find(p => p.id === currentProfileId);
        if (profile) {
          set((s) => ({
            streamProfiles: s.streamProfiles.map(p =>
              p.id === currentProfileId ? { ...p, alertsMasterEnabled: enabled, updatedAt: new Date().toISOString() } : p
            ),
          }));
        }
      },

      // ══ Spotify ══════════════════════════════════
      setSpotifyConnected: (connected) => set({ spotifyConnected: connected }),
      setSpotifyNowPlaying: (np) => set({ spotifyNowPlaying: np }),
      setSpotifyQueue: (q) => set({ spotifyQueue: q }),

      // ══ External Connections ══════════════════════
      setObsConnected: (connected) => set({ obsConnected: connected }),
      setSbConnected: (connected) => set({ sbConnected: connected }),
      setMcConnected: (connected) => set({ mcConnected: connected }),

      // ══ TikTok Connection ═══
      setTikTokConnected: (username, roomId) => set((s) => ({
        tikTokConnection: {
          status: "connected",
          username,
          roomId,
          viewerCount: 0,
          stats: { gifts: 0, likes: 0, views: 0, follows: 0 },
          reconnectAttempts: 0,
          isReconnecting: false,
        },
        isLive: true,
        liveUsername: username,
        stats: { gifts: 0, likes: 0, views: 0, follows: 0 },
      })),
      setTikTokDisconnected: () => set((s) => ({
        tikTokConnection: { ...s.tikTokConnection, status: "disconnected", username: "", isReconnecting: false },
        isLive: false,
        liveUsername: "",
      })),
      setTikTokStats: (partial) => set((s) => ({
        tikTokConnection: { ...s.tikTokConnection, stats: { ...s.tikTokConnection.stats, ...partial } },
        stats: { ...s.stats, ...partial },
      })),
      setTikTokReconnecting: (isReconnecting) => set((s) => ({
        tikTokConnection: { ...s.tikTokConnection, isReconnecting },
      })),

      // ══ Per-screen connection actions ═══
      setScreenConnected: (screenId, username) => set((s) => ({
        screenConnections: { ...s.screenConnections, [screenId]: { screenId, isLive: true, status: "connected", username, roomId: "", viewerCount: 0, reconnectAttempts: 0, isReconnecting: false, stats: { gifts: 0, likes: 0, views: 0, follows: 0 } } },
        // Deprecated compat: also set singleton fields if screen-0
        ...(screenId === "screen-0" ? { isLive: true, liveUsername: username, stats: { gifts: 0, likes: 0, views: 0, follows: 0 }, tikTokConnection: { ...s.tikTokConnection, status: "connected" as const, username, roomId: "", viewerCount: 0, reconnectAttempts: 0, isReconnecting: false, stats: { gifts: 0, likes: 0, views: 0, follows: 0 } } } : {}),
      })),
      setScreenDisconnected: (screenId) => set((s) => ({
        screenConnections: { ...s.screenConnections, [screenId]: { ...s.screenConnections[screenId], isLive: false, status: "disconnected" as const, username: "" } },
        // Deprecated compat: also set singleton fields if screen-0
        ...(screenId === "screen-0" ? { isLive: false, liveUsername: "", tikTokConnection: { ...s.tikTokConnection, status: "disconnected" as const, username: "", isReconnecting: false } } : {}),
      })),
      incrementScreenStat: (screenId, key, value = 1) => set((s) => {
        const conn = s.screenConnections[screenId];
        if (!conn) return {};
        return { screenConnections: { ...s.screenConnections, [screenId]: { ...conn, stats: { ...conn.stats, [key]: conn.stats[key] + value } } } };
      }),
      setScreenStats: (screenId, partial) => set((s) => {
        const conn = s.screenConnections[screenId];
        if (!conn) return {};
        return { screenConnections: { ...s.screenConnections, [screenId]: { ...conn, ...partial, stats: { ...conn.stats, ...partial } } } };
      }),
      setScreenTikTokName: (screenId, name) => set((s) => ({
        screenTikTokNames: { ...s.screenTikTokNames, [screenId]: name },
      })),
      addScreenLiveEvent: (screenId, event) => set((s) => {
        const existing = s.screenLiveEvents[screenId] || [];
        return { screenLiveEvents: { ...s.screenLiveEvents, [screenId]: [event, ...existing].slice(0, 100) } };
      }),
      clearScreenLiveEvents: (screenId) => set((s) => ({
        screenLiveEvents: { ...s.screenLiveEvents, [screenId]: [] },
      })),

      // ══ Dexie Hydration — restore media files stripped by partialize ═══
      hydrateMedia: async () => {
        try {
          const actions = get().actions;
          const updatedActions = await Promise.all(
            actions.map(async (action) => {
              if (action.soundFile || action.videoFile || action.imageFile) return action; // already hydrated
              const media = await getActionMediaArray(action.id);
              if (!media || media.length === 0) return action;
              const patched = { ...action };
              for (const m of media) {
                if (m.type === "sound") { patched.soundFile = m.file; patched.soundFileName = m.fileName; }
                if (m.type === "video") { patched.videoFile = m.file; patched.videoFileName = m.fileName; }
                if (m.type === "image") { patched.imageFile = m.file; patched.imageFileName = m.fileName; }
              }
              return patched;
            })
          );
          console.log('[IMAGE-MEDIA-LIFECYCLE-DIAG]', JSON.stringify({
            operation: 'hydrateMedia',
            stage: 'complete',
            currentProfileId: get().currentProfileId,
            relevantActionIds: updatedActions.map((action) => action.id),
          }));
          set({ actions: updatedActions });
        } catch (_) {}
      },

      // ══ Custom Sounds Hydration — load from Dexie for current profile ═══
      hydrateCustomSounds: async (profileId: string) => {
        try {
          const { getSoundsByProfile } = await import('../lib/db');
          const dbSounds = await getSoundsByProfile(profileId);
          const state = get();

          // Merge: only add sounds in DB but not in store (with files)
          for (const dbSound of dbSounds) {
            const existing = state.customSounds.find(s => s.id === dbSound.id);
            if (existing && !existing.file && dbSound.file) {
              state.updateSound(dbSound.id, { file: dbSound.file, fileName: dbSound.fileName });
            } else if (!existing) {
              state.addImportedSound({
                id: dbSound.id,
                name: dbSound.name,
                file: dbSound.file,
                fileName: dbSound.fileName,
                enabled: true,
                profileId: dbSound.profileId,
                createdAt: new Date().toISOString(),
              });
            }
          }
        } catch (_) {}
      },

      // ══ Migration — assign legacy custom sounds (without profileId) to a profile ═══
      migrateLegacyCustomSounds: async (targetProfileId: string) => {
        const state = get();
        const legacySounds = state.customSounds.filter(s => !s.profileId);
        if (legacySounds.length === 0) return;

        // Check if migration already completed for this profile
        const migrationKey = `customSoundsMigration_${targetProfileId}`;
        const migrationDone = localStorage.getItem(migrationKey);
        if (migrationDone === 'true') {
          console.log('[MIGRATION] Already completed for profile', targetProfileId);
          return;
        }

        console.log('[MIGRATION] Migrating', legacySounds.length, 'legacy custom sounds to profile', targetProfileId);

        const { saveSound, getSound } = await import('../lib/db');
        let allSucceeded = true;
        const failedSounds: string[] = [];

        // Use for...of loop to properly handle async operations
        const updatedSounds = [...state.customSounds];
        for (let i = 0; i < updatedSounds.length; i++) {
          const s = updatedSounds[i];
          if (!s.profileId) {
            // Try to recover binary: prefer Zustand's file (available on first load),
            // fallback to existing Dexie record by ID (before profileId was added)
            let fileToSave = s.file;

            if (!fileToSave) {
              // Attempt to recover from Dexie by stable sound ID
              try {
                const existingInDb = await getSound(s.id);
                if (existingInDb?.file) {
                  fileToSave = existingInDb.file;
                  console.log('[MIGRATION] Recovered binary from Dexie for sound', s.id);
                }
              } catch (_) {}
            }

            // CRITICAL: Never save undefined/null binary
            if (!fileToSave) {
              console.error('[MIGRATION] FAILED - No binary available for sound', {
                id: s.id,
                name: s.name,
                fileName: s.fileName,
              });
              allSucceeded = false;
              failedSounds.push(s.id);
              // Return original sound WITHOUT profileId so migration can retry
              continue;
            }

            // Save with all metadata preserved
            try {
              await saveSound(
                s.id,
                s.name,
                fileToSave,
                s.fileName,
                targetProfileId
              );
            } catch {
              allSucceeded = false;
              failedSounds.push(s.id);
              continue;
            }

            // Preserve ALL metadata including enabled, createdAt
            updatedSounds[i] = {
              ...s,
              profileId: targetProfileId,
              file: fileToSave,
              enabled: s.enabled ?? true,
              createdAt: s.createdAt ?? new Date().toISOString(),
            };
          }
        }

        set({ customSounds: updatedSounds });

        // Only mark migration complete if ALL sounds succeeded
        if (allSucceeded) {
          localStorage.setItem(migrationKey, 'true');
          console.log('[MIGRATION] Completed successfully for profile', targetProfileId);
        } else {
          console.error('[MIGRATION] PARTIAL FAILURE - failed sounds:', failedSounds);
          console.error('[MIGRATION] Migration NOT marked complete - will retry on next startup');
        }
      },
    }),
    {
      name: "rf-app-storage",
      partialize: (state) => ({
        ...state,
        _isRehydrating: undefined, // never persist rehydration flag
        // Strip media blobs from top-level AND profile-scoped actions.
        // Large media in profile.actions can exceed localStorage quota → silent persist failure.
        actions: state.actions.map(({ soundFile, videoFile, imageFile, ...rest }) => rest),
        streamProfiles: state.streamProfiles.map((p) => ({
          ...p,
          actions: (p.actions || []).map(({ soundFile, videoFile, imageFile, ...rest }: any) => rest),
        })),
        customSounds: state.customSounds,
        // Strip runtime connection state — all screens start offline on restart
        tikTokConnection: {
          ...DEFAULT_TIKTOK_CONNECTION,
        },
        screenConnections: Object.fromEntries(
          SCREEN_IDS.map(id => [id, { screenId: id, isLive: false, username: "", roomId: "", viewerCount: 0, status: "disconnected" as const, reconnectAttempts: 0, isReconnecting: false, stats: { gifts: 0, likes: 0, views: 0, follows: 0 } }])
        ),
        isLive: false,
        liveUsername: "",
        liveEvents: [],
        screenLiveEvents: Object.fromEntries(SCREEN_IDS.map(id => [id, []])),
      }),
      // Forensic: log rehydration actions AND verify actual localStorage content
      onRehydrateStorage: (state) => {
        if (state) {
          // Read actual localStorage BEFORE any merge
          let storageRaw = null;
          let storageExists = false;
          try {
            storageRaw = localStorage.getItem("rf-app-storage");
            storageExists = storageRaw !== null;
          } catch (e) { }

          console.log("[RUNTIME-STORAGE-1]", JSON.stringify({
            storageKey: "rf-app-storage",
            storageExists,
            storageByteLength: storageRaw ? storageRaw.length : 0,
          }));

          let parsed = null;
          if (storageRaw) {
            try {
              parsed = JSON.parse(storageRaw);
            } catch (e) { }
          }

          console.log("[RUNTIME-STORAGE-2]", JSON.stringify({
            parsedExists: parsed !== null,
            actionsCount: parsed?.state?.actions?.length ?? 0,
            eventsCount: parsed?.state?.events?.length ?? 0,
            profilesCount: parsed?.state?.streamProfiles?.length ?? 0,
            currentProfileId: parsed?.state?.currentProfileId,
          }));

          console.log("[RUNTIME-HYDRATE-1]", JSON.stringify({
            phase: "rehydrate",
            persistedActionsCount: state.actions?.length ?? 0,
            persistedEventsCount: state.events?.length ?? 0,
            currentProfileId: state.currentProfileId,
            profileActionCounts: state.streamProfiles?.map((p: StreamProfile) => ({
              profileId: p.id,
              profileName: p.name,
              actionCount: p.actions?.length ?? 0,
              eventCount: p.events?.length ?? 0,
            })) ?? [],
          }));
        }

        // OBS endpoint: preserve valid custom IP/port; fill only missing/invalid
        // with defaults (127.0.0.1:4455). Never overwrite a valid saved value.
        // Never touch obsPassword.
        return (hydrated) => {
          const sc = hydrated?.setupConfig;
          if (sc) {
            const next = normalizeObsEndpointOnRehydrate(sc);
            if (next.obsIp !== sc.obsIp || next.obsPort !== sc.obsPort) {
              useAppStore.setState({
                setupConfig: {
                  ...sc,
                  obsIp: next.obsIp,
                  obsPort: next.obsPort,
                },
              });
            }
          }

          // Recalculate profile locks after rehydration using actual persisted state.
          // Uses the rehydrated streamProfiles and currentProfileId (not pre-rehydration defaults).
          // Handles both initialization orders: license init before or after rehydration.
          const { streamProfiles, currentProfileId } = hydrated ?? {};
          if (streamProfiles && currentProfileId) {
            const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
            const { profiles: updated } = calculateProfileLockState(streamProfiles, currentProfileId, maxProfiles);
            useAppStore.setState({ streamProfiles: updated });
          }
        };
      },
      // Guard against an empty persisted streamProfiles overwriting defaults
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Record<string, unknown>;
        // Prefer non-empty profile snapshot when both exist — do not let
        // empty default profiles overwrite persisted actions/events.
        const persistedProfiles = Array.isArray(persisted?.streamProfiles)
          ? (persisted.streamProfiles as StreamProfile[])
          : [];
        const currentProfiles = currentState.streamProfiles || [];
        const persistedHasData = persistedProfiles.some(
          (p) => (p.actions?.length ?? 0) > 0 || (p.events?.length ?? 0) > 0
        );
        const currentHasData = currentProfiles.some(
          (p) => (p.actions?.length ?? 0) > 0 || (p.events?.length ?? 0) > 0
        );
        let streamProfiles: StreamProfile[];
        if (persistedProfiles.length > 0 && (!currentHasData || persistedHasData)) {
          streamProfiles = persistedProfiles;
        } else if (currentProfiles.length > 0) {
          streamProfiles = currentProfiles;
        } else {
          streamProfiles = persistedProfiles.length > 0 ? persistedProfiles : currentProfiles;
        }

        // Restore isDefault: true for built-in default profiles that lost it during
        // persistence/migration. Only applies when isDefault is undefined and name
        // matches a canonical built-in profile name. Never overwrites explicit isDefault.
        const builtinDefaultNames = new Set([
          "Stream Profile 1", "Stream Profile 2", "Stream Profile 3", "Stream Profile 4",
          "Stream Profile 5", "Stream Profile 6", "Stream Profile 7", "Stream Profile 8",
          "Stream Profile 9", "Stream Profile 10"
        ]);
        streamProfiles = streamProfiles.map(p => ({
          ...p,
          isDefault: p.isDefault ?? builtinDefaultNames.has(p.name.trim())
        }));

        // Keep top-level actions/events from whichever side has more data.
        const persistedActions = (persisted?.actions as Action[] | undefined) ?? [];
        const persistedEvents = (persisted?.events as Event[] | undefined) ?? [];
        const currentActions = currentState.actions ?? [];
        const currentEvents = currentState.events ?? [];
        const actions =
          persistedActions.length >= currentActions.length ? persistedActions : currentActions;
        const events =
          persistedEvents.length >= currentEvents.length ? persistedEvents : currentEvents;

        // Preserve currentProfileId from persistence when possible.
        const persistedProfileId = persisted?.currentProfileId as string | null | undefined;
        const currentProfileId =
          persistedProfileId && streamProfiles.some((p) => p.id === persistedProfileId)
            ? persistedProfileId
            : currentState.currentProfileId;

        return {
          ...currentState,
          ...persisted,
          actions,
          events,
          streamProfiles,
          currentProfileId,
        };
      },
    }
  )
);

// ── Central profile slot calculation helper ──────────────────────────
// Determines which profiles occupy the available slots based on the new slot model.
//
// Slot occupancy rules:
// 1. Active profile ALWAYS occupies a slot (never locked)
// 2. Custom profiles (isDefault === false) occupy slots
// 3. Default profiles (isDefault === true) with meaningful user data occupy slots
// 4. Empty default placeholders (isDefault === true, no meaningful data) are placeholders
//    that can be replaced by custom profiles
// 4. Total unlocked/usable profiles must NEVER exceed maxProfiles
// 5. Locked state is DERIVED from this calculation, not stored as source of truth
//
// Meaningful data is defined as any user-configured content:
// - actions.length > 0
// - events.length > 0
// - customSounds.length > 0
// - overlaySettings has user-configured values (non-empty object)
// - alertsSettings has user-configured values (non-default)
// - tiktokUsername is set (non-empty string)
//
// Backward compatibility: profiles without isDefault field are classified as:
// - isDefault = true if id starts with "profile-" (legacy defaults)
// - isDefault = false if id starts with "spf_" or otherwise (legacy custom)
function hasMeaningfulData(profile: StreamProfile): boolean {
  if ((profile.actions?.length ?? 0) > 0) return true;
  if ((profile.events?.length ?? 0) > 0) return true;
  if ((profile.customSounds?.length ?? 0) > 0) return true;
  if (profile.tiktokUsername && profile.tiktokUsername.trim().length > 0) return true;
  if (profile.overlaySettings && Object.keys(profile.overlaySettings).length > 0) return true;
  if (profile.alertsSettings && Object.keys(profile.alertsSettings).length > 0) {
    // Check if alertsSettings has non-default values
    const hasNonDefaultAlerts = Object.entries(profile.alertsSettings).some(([key, value]) => {
      if (!value || typeof value !== 'object') return true;
      const defaultAlerts = DEFAULT_ALERTS[key as keyof typeof DEFAULT_ALERTS];
      if (!defaultAlerts) return true;
      return JSON.stringify(value) !== JSON.stringify(defaultAlerts);
    });
    if (hasNonDefaultAlerts) return true;
  }
  return false;
}

function isDefaultProfile(profile: StreamProfile): boolean {
  // Backward compatibility: classify based on id pattern if isDefault not set
  if (profile.isDefault !== undefined) return profile.isDefault;
  if (profile.id.startsWith('profile-')) return true; // legacy defaults
  if (profile.id.startsWith('spf_')) return false; // legacy custom
  return false; // treat unknown as custom (safer)
}

function isCustomProfile(profile: StreamProfile): boolean {
  return !isDefaultProfile(profile);
}

function profileOccupiesSlot(profile: StreamProfile, activeProfileId: string | null): boolean {
  // Active profile ALWAYS occupies a slot
  if (profile.id === activeProfileId) return true;
  // Custom profiles always occupy a slot
  if (isCustomProfile(profile)) return true;
  // Default profiles with meaningful data occupy a slot
  if (isDefaultProfile(profile) && hasMeaningfulData(profile)) return true;
  // Empty default placeholders do NOT occupy a slot
  return false;
}

/**
 * Central helper to calculate profile slot state for all profiles.
 * Returns an object with locked state for each profile and total occupied count.
 *
 * @param profiles - Array of stream profiles
 * @param currentProfileId - ID of currently active profile
 * @param maxProfiles - Maximum number of profiles allowed for current license
 * @returns Object containing updated profiles with correct locked state and occupied count
 */
function calculateProfileLockState(
  profiles: StreamProfile[],
  currentProfileId: string | null,
  maxProfiles: number
): { profiles: StreamProfile[]; occupiedCount: number } {
  // Default profiles have their own entitlement pool. Custom profiles use
  // remaining capacity and never displace default placeholders.
  const defaultProfiles = profiles.filter((profile) => isDefaultProfile(profile));
  const customProfiles = profiles.filter((profile) => isCustomProfile(profile));
  // Diagnostic: slot allocation
  console.log('[LOCK-SLOTS-DIAG]', JSON.stringify({
    marker: 'calculateProfileLockState slot allocation',
    totalProfiles: profiles.length,
    defaultProfilesCount: defaultProfiles.length,
    customProfilesCount: customProfiles.length,
    maxProfiles,
    defaultSlots: Math.min(10, maxProfiles),
    customSlots: Math.max(0, maxProfiles - Math.min(10, maxProfiles)),
    defaultProfileIds: defaultProfiles.map(p => p.id),
    customProfileIds: customProfiles.map(p => p.id)
  }));

  // Sort default profiles deterministically, keeping the active default first.
  const sortedProfiles = [...defaultProfiles].sort((a, b) => {
    const aActive = a.id === currentProfileId;
    const bActive = b.id === currentProfileId;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    const aNum = parseInt(a.id.replace('profile-', ''), 10) || 999;
    const bNum = parseInt(b.id.replace('profile-', ''), 10) || 999;
    return aNum - bNum;
  });
  const sortedCustomProfiles = [...customProfiles].sort((a, b) => {
    const aActive = a.id === currentProfileId;
    const bActive = b.id === currentProfileId;
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return 0;
  });
  const defaultSlots = Math.min(10, maxProfiles);
  const customSlots = Math.max(0, maxProfiles - defaultSlots);
  const profilesWithSlots = new Set<string>();
  for (const profile of sortedProfiles.slice(0, defaultSlots)) profilesWithSlots.add(profile.id);
  for (const profile of sortedCustomProfiles.slice(0, customSlots)) profilesWithSlots.add(profile.id);

  // Diagnostic: log slot allocation details before mapping
  console.log('[LOCK-CALC-DIAG-2]', JSON.stringify({
    marker: 'slot allocation details',
    maxProfiles,
    defaultSlots,
    customSlots,
    defaultProfilesLength: defaultProfiles.length,
    customProfilesLength: customProfiles.length,
    defaultProfiles: defaultProfiles.map(p => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      isDefaultProfileResult: isDefaultProfile(p),
      idStartsWithProfile: p.id.startsWith('profile-'),
      hasMeaningfulData: hasMeaningfulData(p),
      getsSlot: profilesWithSlots.has(p.id)
    })),
    customProfiles: customProfiles.map(p => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      isDefaultProfileResult: isDefaultProfile(p),
      idStartsWithProfile: p.id.startsWith('profile-'),
      getsSlot: profilesWithSlots.has(p.id)
    }))
  }));

  const updatedProfiles = profiles.map(p => ({
    ...p,
    locked: !profilesWithSlots.has(p.id),
  }));
  const occupiedCount = updatedProfiles.filter(p => !p.locked).length;
  return { profiles: updatedProfiles, occupiedCount };
}

// Export for use in other modules
export { calculateProfileLockState, profileOccupiesSlot, hasMeaningfulData, isDefaultProfile, isCustomProfile };

// ── Recalculate profile lock state when license initializes/updates ──
// Fixes race: pullCloudProfiles() runs before license is init'd → profiles 2-10 locked
// even for Pro users. This listener fires once the license state is authoritative.
// Current active profile should NEVER be locked, regardless of position.
window.addEventListener('rosae:license-updated', () => {
  const store = useAppStore.getState();
  const { streamProfiles, currentProfileId } = store;
  const licenseState = useLicenseStore.getState();
  const effectivePlan = licenseState.effectivePlan();
  const isInitialized = licenseState.isInitialized;
  const maxProfiles = licenseState.getMaxStreamProfiles();

  // Diagnostic: before calculation
  console.log('[LICENSE-UPDATE-DIAG-1]', JSON.stringify({
    marker: 'rosae:license-updated listener fired',
    effectivePlan,
    isInitialized,
    maxProfiles,
    profileCount: streamProfiles.length,
    currentProfileId,
    beforeProfiles: streamProfiles.map(p => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      locked: p.locked
    }))
  }));

  const { profiles: updated, occupiedCount } = calculateProfileLockState(streamProfiles, currentProfileId, maxProfiles);

  // Diagnostic: after calculation
  console.log('[LICENSE-UPDATE-DIAG-2]', JSON.stringify({
    marker: 'calculateProfileLockState result',
    maxProfiles,
    occupiedCount,
    afterProfiles: updated.map(p => ({ id: p.id, locked: p.locked }))
  }));

  useAppStore.setState({ streamProfiles: updated });
});

// Export the store instance for non-React contexts (e.g., overlay-store)
export const appStore = useAppStore;
