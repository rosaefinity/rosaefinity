import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Action, Event, CustomSound, Stats, LiveEvent, TikTokGift, SetupConfig, LicenseInfo, StreamProfile, ScreenId, ScreenConnectionState, TikTokConnectionState } from "../types";
import { SCREEN_IDS } from "../types";
import { getActionMedia, getActionMediaArray, deleteActionMedia } from "../lib/db";
import { useLicenseStore } from "./license-store";

interface AppStore {
  // Actions
  actions: Action[];
  addAction: (action: Omit<Action, "id" | "createdAt" | "updatedAt">) => Promise<void>;
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

const DEFAULT_SETUP: SetupConfig = {
  tikTokName: "",
  screenTikTokNames: {} as Record<ScreenId, string>,
  currencyName: "Points",
  pointsGift: 3, pointsLike: 1, pointsFollow: 5, pointsComment: 1, pointsShare: 2, pointsSubscribe: 10,
  subBonus: 0, levelPoints: 50, levelMultiplier: 1.03,
  obsIp: "127.0.0.1", obsPort: 4567, obsPassword: "",
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
  { id: "profile-1", name: "Stream Profile 1", icon: "🌹", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-2", name: "Stream Profile 2", icon: "🔥", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-3", name: "Stream Profile 3", icon: "🎮", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-4", name: "Stream Profile 4", icon: "❤️", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-5", name: "Stream Profile 5", icon: "💬", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-6", name: "Stream Profile 6", icon: "🎁", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-7", name: "Stream Profile 7", icon: "🙂", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-8", name: "Stream Profile 8", icon: "👍", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-9", name: "Stream Profile 9", icon: "📞", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "profile-10", name: "Stream Profile 10", icon: "☑️", tiktokUsername: "", overlaySettings: {}, alertsSettings: DEFAULT_ALERTS, alertsMasterEnabled: true, actions: [], events: [], customSounds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
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
      addAction: async (action) => {
        const now = new Date().toISOString();
        const newAction: Action = {
          ...action,
          id: "act_" + Math.random().toString(36).substring(2, 10),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ actions: [...s.actions, newAction] }));
      },
      updateAction: async (id, action) => {
        set((s) => ({
          actions: s.actions.map((a) => (a.id === id ? { ...a, ...action, updatedAt: new Date().toISOString() } : a)),
        }));
      },
      deleteAction: (id) => set((s) => ({ actions: s.actions.filter((a) => a.id !== id) })),
      duplicateAction: (id) => {
        const action = get().actions.find((a) => a.id === id);
        if (action) {
          const now = new Date().toISOString();
          const copy: Action = { ...action, id: "act_" + Math.random().toString(36).substring(2, 10), name: action.name + " Copy", createdAt: now, updatedAt: now };
          set((s) => ({ actions: [...s.actions, copy] }));
        }
      },

      // ══ Events CRUD ══════════════════════════════
      addEvent: (event) => {
        const now = new Date().toISOString();
        const newEvent: Event = {
          ...event,
          id: "evt_" + Math.random().toString(36).substring(2, 10),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ events: [...s.events, newEvent] }));
      },
      updateEvent: (id, event) => set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...event, updatedAt: new Date().toISOString() } : e)) })),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      // ══ Sounds CRUD ══════════════════════════════
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
      updateSetupConfig: (config) => set((s) => ({ setupConfig: { ...s.setupConfig, ...config } })),

      // ══ Stream Profiles ══════════════════════════
      _isRehydrating: true,
      _setRehydrating: (v) => set({ _isRehydrating: v }),

      replaceProfiles: (profiles) => {
        const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        const lockedProfiles = profiles.map((profile, index) => ({
          ...profile,
          locked: index >= maxProfiles,
        }));
        set({
          streamProfiles: lockedProfiles,
          currentProfileId: lockedProfiles.length > 0 ? lockedProfiles[0].id : null,
        });
      },

      // V3: Apply portable profile configuration to the CURRENTLY ACTIVE profile
      applyProfileImport: (profileConfig: Record<string, unknown>) => {
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
        updated[targetIdx] = {
          ...updated[targetIdx],
          name: (profileConfig.name as string) ?? updated[targetIdx].name,
          icon: (profileConfig.icon as string) ?? updated[targetIdx].icon,
          tiktokUsername: (profileConfig.tiktokUsername as string) ?? updated[targetIdx].tiktokUsername,
          overlaySettings: (profileConfig.overlaySettings as Record<string, unknown>) ?? updated[targetIdx].overlaySettings,
          alertsSettings: (profileConfig.alertsSettings as Record<string, unknown>) ?? updated[targetIdx].alertsSettings,
          alertsMasterEnabled: (profileConfig.alertsMasterEnabled as boolean) ?? updated[targetIdx].alertsMasterEnabled,
          ttsSettings: (profileConfig.ttsSettings as any) ?? updated[targetIdx].ttsSettings,
          actions: (profileConfig.actions as Action[]) ?? updated[targetIdx].actions,
          events: (profileConfig.events as Event[]) ?? updated[targetIdx].events,
          customSounds: (profileConfig.customSounds as any[]) ?? updated[targetIdx].customSounds,
          updatedAt: now,
        };

        const targetProfile = updated[targetIdx];

        // Recalculate lock state
        const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        const lockedProfiles = updated.map((p, i) => ({
          ...p,
          locked: i >= maxProfiles,
        }));

        // Sync the target profile's actions/events/alerts into top-level state
        set({
          streamProfiles: lockedProfiles,
          actions: targetProfile.actions || [],
          events: targetProfile.events || [],
          alertSettings: targetProfile.alertsSettings || alertSettings,
          setupConfig: { ...setupConfig, tikTokName: targetProfile.tiktokUsername || "" },
        });
      },

      // V2/V1: Import all profiles by name matching (legacy)
      importProfilesByName: (importedProfiles) => {
        const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
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
            // Update existing profile by name match
            updated[existingIdx] = {
              ...updated[existingIdx],
              icon: imported.icon,
              tiktokUsername: imported.tiktokUsername,
              alertsMasterEnabled: imported.alertsMasterEnabled,
              alertsSettings: imported.alertsSettings,
              ttsSettings: imported.ttsSettings,
              actions: imported.actions,
              events: imported.events,
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
              locked: updated.length >= maxProfiles,
              createdAt: now,
              updatedAt: now,
            };
            updated.push(newProfile);
          }
        }

        // Recalculate lock state for all profiles
        const lockedProfiles = updated.map((p, i) => ({
          ...p,
          locked: i >= maxProfiles,
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
            return;
          }
        }

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
            actions: Array.isArray(p.actions) ? (p.actions as Action[]) : [],
            events: Array.isArray(p.events) ? (p.events as Event[]) : [],
            customSounds: Array.isArray(p.customSounds) ? (p.customSounds as CustomSound[]) : [],
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
          const filteredCloudProfiles = cloudProfiles.filter(
            cp => !pendingNames.has(cp.name.trim().toLowerCase())
          );

          const mergedProfiles = [...filteredCloudProfiles, ...localOnlyProfiles, ...pendingLocalProfiles];

          // Only apply locks if the license store is already initialized.
          // If not, set all profiles unlocked — the 'rosae:license-updated' event
          // will recalculate correct locks once entitlements are authoritative.
          const licenseInitialized = useLicenseStore.getState().isInitialized;
          const maxProfiles = licenseInitialized
            ? useLicenseStore.getState().getMaxStreamProfiles()
            : mergedProfiles.length;
          const lockedProfiles = mergedProfiles.map((profile, index) => ({
            ...profile,
            locked: index >= maxProfiles,
          }));

          // Sync the active profile's actions/events/alerts into top-level state
          // so the UI immediately reflects the correct data after cloud merge.
          // Without this, top-level actions/events remain stale/empty after pull.
          const activeId = lockedProfiles.length > 0 ? lockedProfiles[0].id : null;
          const active = activeId ? lockedProfiles.find(p => p.id === activeId) : null;

          set({
            streamProfiles: lockedProfiles,
            currentProfileId: activeId,
            ...(active ? {
              actions: active.actions || [],
              events: active.events || [],
              alertSettings: active.alertSettings || DEFAULT_ALERTS,
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

            const lockedProfiles = updatedProfiles.map((profile, index) => ({
              ...profile,
              locked: index >= maxProfiles,
            }));

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
        const { streamProfiles } = get();
        const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        if (streamProfiles.length >= maxProfiles) {
          console.warn(`[PROFILE-ENFORCEMENT] Cannot add profile: limit reached (${maxProfiles})`);
          return;
        }
        const now = new Date().toISOString();
        const newProfile: StreamProfile = { ...profile, id: "spf_" + Math.random().toString(36).substring(2, 10), locked: false, alertsMasterEnabled: profile.alertsMasterEnabled ?? true, createdAt: now, updatedAt: now };
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

        const targetProfile = streamProfiles.find(p => p.id === targetId);
        if (!targetProfile) {
          console.warn(`[PROFILE-ENFORCEMENT] Profile not found: ${targetId}`);
          return;
        }

        // Lock-state check: blocked if profile is locked
        if (targetProfile.locked) {
          console.warn(`[PROFILE-ENFORCEMENT] Profile is locked: ${targetId}`);
          return;
        }

        // Entitlement check: defense-in-depth
        const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
        const targetIndex = streamProfiles.findIndex(p => p.id === targetId);
        if (targetIndex >= maxProfiles) {
          console.warn(`[PROFILE-ENFORCEMENT] Profile index ${targetIndex} blocked (max ${maxProfiles})`);
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
              state.addSound({ name: dbSound.name, file: dbSound.file, fileName: dbSound.fileName, enabled: true, profileId: dbSound.profileId } as any);
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
        actions: state.actions.map(({ soundFile, videoFile, imageFile, ...rest }) => rest),
        customSounds: state.customSounds.map(({ file, ...rest }) => rest), // profileId is kept in rest
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
      // Forensic: log rehydration actions
      onRehydrateStorage: (state) => {
        if (state) {
          console.log('[FORENSIC-ACTIONS-REHYDRATE]', JSON.stringify({
            actionCount: state.actions?.length ?? 0,
            actionIds: state.actions?.map((a: Action) => a.id) ?? [],
            profileActionCounts: state.streamProfiles?.map((p: StreamProfile) => ({
              profileId: p.id,
              profileName: p.name,
              actionCount: p.actions?.length ?? 0,
              actionIds: p.actions?.map((a: Action) => a.id) ?? [],
            })) ?? [],
          }));
        }
      },
      // Guard against an empty persisted streamProfiles overwriting defaults
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Record<string, unknown>;
        return {
          ...currentState,
          ...persisted,
          streamProfiles: Array.isArray(persisted?.streamProfiles) && persisted.streamProfiles.length > 0
            ? persisted.streamProfiles
            : currentState.streamProfiles,
        };
      },
    }
  )
);

// ── Recalculate profile lock state when license initializes/updates ──
// Fixes race: pullCloudProfiles() runs before license is init'd → profiles 2-10 locked
// even for Pro users. This listener fires once the license state is authoritative.
window.addEventListener('rosae:license-updated', () => {
  const store = useAppStore.getState();
  const { streamProfiles } = store;
  const maxProfiles = useLicenseStore.getState().getMaxStreamProfiles();
  let changed = false;
  const updated = streamProfiles.map((p, i) => {
    const shouldBeLocked = i >= maxProfiles;
    if (p.locked !== shouldBeLocked) {
      changed = true;
      return { ...p, locked: shouldBeLocked };
    }
    return p;
  });
  if (changed) {
    useAppStore.setState({ streamProfiles: updated });
  }
});

// Export the store instance for non-React contexts (e.g., overlay-store)
export const appStore = useAppStore;
