import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Action, Event, CustomSound, Stats, LiveEvent, TikTokGift, SetupConfig, LicenseInfo, StreamProfile, ScreenId, ScreenConnectionState } from "../types";
import { SCREEN_IDS } from "../types";
import { getActionMedia, getActionMediaArray, deleteActionMedia } from "../lib/db";

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

  // Live events feed
  liveEvents: LiveEvent[];
  addLiveEvent: (event: LiveEvent) => void;
  clearLiveEvents: () => void;

  // Points System
  pointsUsers: Record<string, { username: string; name: string; points: number; level: number; giftCount: number; likeCount: number; followCount: number; commentCount: number; shareCount: number; firstSeen: number; lastSeen: number }>;
  pointsConfig: { currencyName: string; pointsGift: number; pointsLike: number; pointsFollow: number; pointsComment: number; pointsShare: number; pointsSubscribe: number; subBonus: number; levelPoints: number; levelMultiplier: number };
  updatePointsConfig: (config: Partial<AppStore["pointsConfig"]>) => void;
  awardPoints: (type: "gift" | "like" | "follow" | "comment" | "share" | "subscribe", username: string, nickname: string) => void;
  deductPoints: (username: string, amount: number) => boolean;
  resetAllPoints: () => void;
  halvePoints: (percent: number) => void;

  // Alert Settings
  alertSettings: Record<string, { enabled: boolean; minDiamond?: number; minLikes?: number; duration: number; sound?: string; color?: string; keyword?: string }>;
  updateAlertSetting: (event: string, settings: Partial<AppStore["alertSettings"][string]>) => void;
  alertsMasterEnabled: boolean;
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

  // Dexie hydration â€” restore media stripped by partialize
  hydrateMedia: () => Promise<void>;

  // â•â• TIKTOK CONNECTION STATE â•â•
  tikTokConnection: TikTokConnectionState;
  setTikTokConnected: (username: string, roomId: string) => void;
  setTikTokDisconnected: () => void;
  setTikTokStats: (stats: Partial<Stats>) => void;
  setTikTokReconnecting: (isReconnecting: boolean) => void;

  // â•â• MULTI-SCREEN CONNECTION STATE â•â•
  screenConnections: Record<ScreenId, ScreenConnectionState>;
  setScreenConnected: (screenId: ScreenId, username: string) => void;
  setScreenDisconnected: (screenId: ScreenId) => void;
  incrementScreenStat: (screenId: ScreenId, key: keyof Stats, value?: number) => void;
  setScreenStats: (screenId: ScreenId, stats: Partial<Stats>) => void;

  screenLiveEvents: Record<ScreenId, LiveEvent[]>;
  addScreenLiveEvent: (screenId: ScreenId, event: LiveEvent) => void;
  clearScreenLiveEvents: (screenId: ScreenId) => void;
}

import type { SpotifyTrack } from "../types";

const DEFAULT_SETUP: SetupConfig = {
  tikTokName: "",
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
  overlayPermanent: false, halvingPercent: 50,
};

const DEFAULT_LICENSE: LicenseInfo = {
  isPro: false, plan: "free",
  limits: { actions: 5, customSounds: 3, streamProfiles: 1 },
};

const DEFAULT_POINTS_CONFIG = {
  currencyName: "Points",
  pointsGift: 3, pointsLike: 1, pointsFollow: 5, pointsComment: 1, pointsShare: 2, pointsSubscribe: 10,
  subBonus: 0, levelPoints: 50, levelMultiplier: 1.03,
};

const DEFAULT_ALERTS: Record<string, { enabled: boolean; minDiamond?: number; minLikes?: number; duration: number; sound?: string; color?: string; keyword?: string }> = {
  gift: { enabled: true, minDiamond: 0, duration: 5, color: "#e0306a" },
  follow: { enabled: true, duration: 4, color: "#4e7bff" },
  like: { enabled: false, minLikes: 100, duration: 3, color: "#e0306a" },
  share: { enabled: true, duration: 4, color: "#3ecf8e" },
  comment: { enabled: false, duration: 4, color: "#f0a020" },
  subscribe: { enabled: true, duration: 5, color: "#a855f7" },
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

// â”€â”€ Per-screen defaults â”€â”€
const DEFAULT_SCREEN_CONNECTIONS: Record<ScreenId, ScreenConnectionState> = {} as any;
const DEFAULT_SCREEN_EVENTS: Record<ScreenId, LiveEvent[]> = {} as any;
for (const id of SCREEN_IDS) {
  DEFAULT_SCREEN_CONNECTIONS[id] = { screenId: id, isLive: false, username: "", roomId: "", viewerCount: 0, status: "disconnected", reconnectAttempts: 0, isReconnecting: false, stats: { gifts: 0, likes: 0, views: 0, follows: 0 } };
  DEFAULT_SCREEN_EVENTS[id] = [];
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
      streamProfiles: [],
      currentProfileId: null,
      liveEvents: [],
      pointsUsers: {},
      pointsConfig: DEFAULT_POINTS_CONFIG,
      alertSettings: DEFAULT_ALERTS,
      alertsMasterEnabled: true,
      spotifyConnected: false,
      spotifyNowPlaying: null,
      spotifyQueue: [],
      obsConnected: false,
      sbConnected: false,
      mcConnected: false,

      // â•â• TikTok connection state â•â•
      tikTokConnection: { ...DEFAULT_TIKTOK_CONNECTION },

      // â•â• Per-screen connection state â•â•
      screenConnections: { ...DEFAULT_SCREEN_CONNECTIONS },
      screenLiveEvents: { ...DEFAULT_SCREEN_EVENTS },

      // â•â• Actions CRUD â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

      // â•â• Events CRUD â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

      // â•â• Sounds CRUD â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      addSound: (sound) => {
        const newSound: CustomSound = { ...sound, id: "snd_" + Math.random().toString(36).substring(2, 10), createdAt: new Date().toISOString() };
        set((s) => ({ customSounds: [...s.customSounds, newSound] }));
      },
      deleteSound: (id) => set((s) => ({ customSounds: s.customSounds.filter((snd) => snd.id !== id) })),
      updateSound: (id, updates) => set((s) => ({
        customSounds: s.customSounds.map((snd) => (snd.id === id ? { ...snd, ...updates } : snd)),
      })),

      // â•â• Stats (deprecated wrappers â†’ screen-0) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      setStats: (stats) => get().setScreenStats("screen-0", stats),
      incrementStat: (key, value = 1) => get().incrementScreenStat("screen-0", key, value),

      // â•â• Connection (deprecated wrappers â†’ screen-0) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      setConnected: (username) => get().setScreenConnected("screen-0", username),
      setDisconnected: () => get().setScreenDisconnected("screen-0"),

      // â•â• Gifts â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      setTikTokGifts: (gifts) => set({ tikTokGifts: gifts }),

      // â•â• License â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      setLicenseInfo: (info) => set((s) => ({ licenseInfo: { ...s.licenseInfo, ...info } })),

      // â•â• Setup Config â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      updateSetupConfig: (config) => set((s) => ({ setupConfig: { ...s.setupConfig, ...config } })),

      // â•â• Stream Profiles â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      addProfile: (profile) => {
        const now = new Date().toISOString();
        const newProfile: StreamProfile = { ...profile, id: "spf_" + Math.random().toString(36).substring(2, 10), createdAt: now, updatedAt: now };
        set((s) => ({ streamProfiles: [...s.streamProfiles, newProfile] }));
      },
      updateProfile: (id, updates) => set((s) => ({
        streamProfiles: s.streamProfiles.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p),
      })),
      deleteProfile: (id) => set((s) => ({ streamProfiles: s.streamProfiles.filter(p => p.id !== id) })),
      setCurrentProfile: (id) => set({ currentProfileId: id }),

      // â•â• Live Events Feed (deprecated wrappers â†’ screen-0) â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      addLiveEvent: (event) => get().addScreenLiveEvent("screen-0", { ...event, screenId: "screen-0" }),
      clearLiveEvents: () => get().clearScreenLiveEvents("screen-0"),

      // â•â• Points System â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      updatePointsConfig: (config) => set((s) => ({ pointsConfig: { ...s.pointsConfig, ...config } })),

      awardPoints: (type, username, nickname) => {
        const { pointsUsers, pointsConfig } = get();
        const key = username.toLowerCase().trim();
        if (!key) return;

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

        user.points += earned;
        user.lastSeen = Date.now();
        if (type === "gift") user.giftCount++;
        if (type === "like") user.likeCount++;
        if (type === "follow") user.followCount++;
        if (type === "comment") user.commentCount++;
        if (type === "share") user.shareCount++;
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

      // â•â• Alert Settings â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      updateAlertSetting: (event, settings) => set((s) => ({
        alertSettings: { ...s.alertSettings, [event]: { ...s.alertSettings[event], ...settings } },
      })),
      setAlertsMasterEnabled: (enabled) => set({ alertsMasterEnabled: enabled }),

      // â•â• Spotify â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      setSpotifyConnected: (connected) => set({ spotifyConnected: connected }),
      setSpotifyNowPlaying: (np) => set({ spotifyNowPlaying: np }),
      setSpotifyQueue: (q) => set({ spotifyQueue: q }),

      // â•â• External Connections â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      setObsConnected: (connected) => set({ obsConnected: connected }),
      setSbConnected: (connected) => set({ sbConnected: connected }),
      setMcConnected: (connected) => set({ mcConnected: connected }),

      // â•â• TikTok Connection â•â•â•
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

      // â•â• Per-screen connection actions â•â•â•
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
      addScreenLiveEvent: (screenId, event) => set((s) => {
        const existing = s.screenLiveEvents[screenId] || [];
        return { screenLiveEvents: { ...s.screenLiveEvents, [screenId]: [event, ...existing].slice(0, 100) } };
      }),
      clearScreenLiveEvents: (screenId) => set((s) => ({
        screenLiveEvents: { ...s.screenLiveEvents, [screenId]: [] },
      })),

      // â•â• Dexie Hydration â€” restore media files stripped by partialize â•â•â•
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
    }),
    {
      name: "rf-app-storage",
      partialize: (state) => ({
        ...state,
        actions: state.actions.map(({ soundFile, videoFile, imageFile, ...rest }) => rest),
        customSounds: state.customSounds.map(({ file, ...rest }) => rest),
        // Strip runtime connection state â€” all screens start offline on restart
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
    }
  )
);

