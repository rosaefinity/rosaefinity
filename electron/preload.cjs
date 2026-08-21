const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ── App Info ──
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getPlatform: () => ipcRenderer.invoke("get-platform"),
  getSystemTheme: () => ipcRenderer.invoke("get-system-theme"),
  onSystemThemeChange: (cb) => {
    const listener = (_, theme) => cb(theme);
    ipcRenderer.on("system-theme-changed", listener);
    return () => ipcRenderer.removeListener("system-theme-changed", listener);
  },

  // ── Window Controls ──
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
  hide: () => ipcRenderer.invoke("hide-window"),
  show: () => ipcRenderer.invoke("show-window"),

  // ── External ──
  openExternal: (url) => ipcRenderer.send("open:external", url),
  showItemInFolder: (p) => ipcRenderer.send("show-item-in-folder", p),

  // ── TikTok Connection (per-screen) ──
  connectTikTokScreen: (screenId, username) => ipcRenderer.send("tiktok:connect", { screenId, username }),
  disconnectTikTokScreen: (screenId) => ipcRenderer.send("tiktok:disconnect", { screenId }),
  connectTikTok: (username) => ipcRenderer.send("tiktok:connect", { screenId: "screen-0", username }),
  disconnectTikTok: () => ipcRenderer.send("tiktok:disconnect", { screenId: "screen-0" }),
  onConnected: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("tiktok:connected", listener);
    return () => ipcRenderer.removeListener("tiktok:connected", listener);
  },
  onDisconnected: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("tiktok:disconnected", listener);
    return () => ipcRenderer.removeListener("tiktok:disconnected", listener);
  },
  onEvent: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("tiktok:event", listener);
    return () => ipcRenderer.removeListener("tiktok:event", listener);
  },
  onViewers: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("tiktok:viewers", listener);
    return () => ipcRenderer.removeListener("tiktok:viewers", listener);
  },
  onError: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("tiktok:error", listener);
    return () => ipcRenderer.removeListener("tiktok:error", listener);
  },
  onStats: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("tiktok:stats", listener);
    return () => ipcRenderer.removeListener("tiktok:stats", listener);
  },
  onReconnecting: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("tiktok:reconnecting", listener);
    return () => ipcRenderer.removeListener("tiktok:reconnecting", listener);
  },

  // ── Overlay ──
  openOverlay: () => ipcRenderer.send("overlay:open"),
  closeOverlay: () => ipcRenderer.send("overlay:close"),
  sendToOverlay: (data) => ipcRenderer.send("overlay:send", data),
  onOverlayEvent: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("overlay:event", listener);
    return () => ipcRenderer.removeListener("overlay:event", listener);
  },
  onOverlayConnected: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("overlay:connected", listener);
    return () => ipcRenderer.removeListener("overlay:connected", listener);
  },
  onOverlayDisconnected: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("overlay:disconnected", listener);
    return () => ipcRenderer.removeListener("overlay:disconnected", listener);
  },

  // ── Keystroke ──
  sendKeystroke: (keys, holdMs, eventData) => ipcRenderer.invoke("send-keystroke", keys, holdMs, eventData),
  sendKeystrokes: (keys, opts = {}) => ipcRenderer.invoke("send-keystroke", keys, opts.holdMs || 100, opts.eventData || null),
  onKeystrokeEvent: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("keystroke-event", listener);
    return () => ipcRenderer.removeListener("keystroke-event", listener);
  },

  // ── Global Input Hook ──
  startGlobalHook: (screen) => ipcRenderer.invoke("global-hook:start", screen),
  stopGlobalHook: () => ipcRenderer.invoke("global-hook:stop"),
  getGlobalHookStatus: () => ipcRenderer.invoke("global-hook:status"),
  onGlobalHookEvent: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("global-hook:event", listener);
    return () => ipcRenderer.removeListener("global-hook:event", listener);
  },

  // ── Gifts ──
  requestGifts: () => ipcRenderer.send("gift:request"),
  refreshGifts: () => ipcRenderer.send("gift:refresh"),
  onGiftList: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("gift:list", listener);
    return () => ipcRenderer.removeListener("gift:list", listener);
  },

  // ── Points System ──
  syncPointsConfig: (config) => ipcRenderer.send("points:syncConfig", config),
  awardPoints: (data) => ipcRenderer.send("points:award", data),
  getAllUsers: () => ipcRenderer.invoke("points:getAll"),
  getUser: (username) => ipcRenderer.invoke("points:getUser", username),
  getTopUsers: (limit) => ipcRenderer.invoke("points:getTop", limit),
  getUserCount: () => ipcRenderer.invoke("points:getCount"),
  resetAllPoints: () => ipcRenderer.send("points:resetAll"),
  halvePoints: (percent) => ipcRenderer.send("points:halve", percent),
  toggleChallenge: (active) => ipcRenderer.send("points:toggleChallenge", active),
  deductPoints: (opts) => ipcRenderer.invoke("points:deduct", opts),
  onPointsAwarded: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("points:awarded", listener);
    return () => ipcRenderer.removeListener("points:awarded", listener);
  },
  onPointsReset: (cb) => {
    const listener = (_, d) => cb(d);
    ipcRenderer.on("points:reset", listener);
    return () => ipcRenderer.removeListener("points:reset", listener);
  },

  // ── OBS Controller ──
  obsSetConfig: (config) => ipcRenderer.send("obs:setConfig", config),
  obsConnect: () => ipcRenderer.invoke("obs:connect"),
  obsDisconnect: () => ipcRenderer.invoke("obs:disconnect"),
  obsTest: (opts) => ipcRenderer.invoke("obs:test", opts),
  obsStatus: () => ipcRenderer.invoke("obs:status"),
  obsSwitchScene: (opts) => ipcRenderer.invoke("obs:switchScene", opts),
  obsGetScenes: () => ipcRenderer.invoke("obs:getScenes"),
  obsToggleSource: (opts) => ipcRenderer.invoke("obs:toggleSource", opts),

  // ── Streamer.bot ──
  sbSetConfig: (config) => ipcRenderer.send("sb:setConfig", config),
  sbConnect: () => ipcRenderer.invoke("sb:connect"),
  sbDisconnect: () => ipcRenderer.invoke("sb:disconnect"),
  sbTest: (opts) => ipcRenderer.invoke("sb:test", opts),
  sbStatus: () => ipcRenderer.invoke("sb:status"),
  sbTrigger: (opts) => ipcRenderer.send("sb:trigger", opts),

  // ── Minecraft ──
  mcSetConfig: (config) => ipcRenderer.send("mc:setConfig", config),
  mcTest: (opts) => ipcRenderer.invoke("mc:test", opts),
  mcStatus: () => ipcRenderer.invoke("mc:status"),
  mcExecute: (opts) => ipcRenderer.invoke("mc:execute", opts),
  mcServer: () => ipcRenderer.invoke("mc:server"),
  mcPlayers: () => ipcRenderer.invoke("mc:players"),

  // ── License / Pro ──
  licenseStatus: () => ipcRenderer.invoke("license:status"),
  licenseActivate: (opts) => ipcRenderer.invoke("license:activate", opts),
  licenseDeactivate: () => ipcRenderer.invoke("license:deactivate"),
  licensePlan: () => ipcRenderer.invoke("license:plan"),
  licenseIsPro: () => ipcRenderer.invoke("license:isPro"),
  licenseLimits: () => ipcRenderer.invoke("license:limits"),
  licenseValidateAction: (count) => ipcRenderer.invoke("license:validateAction", count),
  licenseValidateSound: (count) => ipcRenderer.invoke("license:validateSound", count),
  licenseUserData: () => ipcRenderer.invoke("license:userData"),

  // ── License V2 (backend-backed) ──
  licenseV2Status: (userId) => ipcRenderer.invoke("license:status", userId),
  licenseV2Activate: (userId, opts) => ipcRenderer.invoke("license:activate", { userId, ...opts }),
  licenseV2Deactivate: (userId) => ipcRenderer.invoke("license:deactivate", userId),

  // ── Authentication ──
  authRegister: (opts) => ipcRenderer.invoke("auth:register", opts),
  authLogin: (opts) => ipcRenderer.invoke("auth:login", opts),
  authGoogle: (opts) => ipcRenderer.invoke("auth:google", opts),
  authLogout: () => ipcRenderer.invoke("auth:logout"),
  authCurrentUser: () => ipcRenderer.invoke("auth:currentUser"),
  authValidateSession: () => ipcRenderer.invoke("auth:validateSession"),
  authProfileLimit: () => ipcRenderer.invoke("auth:profileLimit"),
  authGetProfiles: () => ipcRenderer.invoke("auth:getProfiles"),
  authCreateProfile: (opts) => ipcRenderer.invoke("auth:createProfile", opts),
  authUpdateProfile: (opts) => ipcRenderer.invoke("auth:updateProfile", opts),
  authDeleteProfile: (opts) => ipcRenderer.invoke("auth:deleteProfile", opts),
  authSetCurrentProfile: (opts) => ipcRenderer.invoke("auth:setCurrentProfile", opts),
  authGetCurrentProfile: () => ipcRenderer.invoke("auth:getCurrentProfile"),
  authExportProfile: (opts) => ipcRenderer.invoke("auth:exportProfile", opts),
  authImportProfile: (opts) => ipcRenderer.invoke("auth:importProfile", opts),

  // ── Admin ──
  adminSearchUsers: (query) => ipcRenderer.invoke("admin:searchUsers", query),
  adminUserDetail: (userId) => ipcRenderer.invoke("admin:userDetail", userId),
  adminExtendLicense: (userId, days) => ipcRenderer.invoke("admin:extendLicense", userId, days),
  adminDowngradeUser: (userId) => ipcRenderer.invoke("admin:downgradeUser", userId),

  // ── Spotify ──
  spotifySetConfig: (config) => ipcRenderer.send("spotify:setConfig", config),
  spotifyAuth: (opts) => ipcRenderer.invoke("spotify:auth", opts),
  spotifyExchange: (opts) => ipcRenderer.invoke("spotify:exchange", opts),
  spotifyStatus: () => ipcRenderer.invoke("spotify:status"),
  spotifyTest: () => ipcRenderer.invoke("spotify:test"),
  spotifySearch: (opts) => ipcRenderer.invoke("spotify:search", opts),
  spotifyAddToQueue: (opts) => ipcRenderer.invoke("spotify:addToQueue", opts),
  spotifySkip: () => ipcRenderer.invoke("spotify:skip"),
  spotifyPlayback: () => ipcRenderer.invoke("spotify:playback"),
  spotifyDevices: () => ipcRenderer.invoke("spotify:devices"),
  spotifyQueue: () => ipcRenderer.invoke("spotify:queue"),
  spotifyPushQueue: (opts) => ipcRenderer.invoke("spotify:pushQueue", opts),
  spotifyRemoveUser: (opts) => ipcRenderer.invoke("spotify:removeUser", opts),
  spotifyClearQueue: () => ipcRenderer.invoke("spotify:clearQueue"),

  // ── Screen Capture ──
  getCaptureSources: () => ipcRenderer.invoke("capture:getSources"),
  setCaptureSource: (sourceId) => ipcRenderer.invoke("capture:setSource", sourceId),
});
