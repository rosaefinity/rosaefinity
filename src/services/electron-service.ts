// =============================================
// Electron Service Layer
// Typed wrapper around window.electronAPI
// =============================================

import type { CaptureSource } from "../types";

/**
 * Result type for all IPC calls
 * Ensures consistent error handling across the app
 */
export interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Safe IPC invocation wrapper
 * Wraps all electronAPI calls with try/catch and returns structured results
 *
 * @example
 * ```ts
 * const result = await safeInvoke(api().getAppVersion);
 * if (result.success) {
 *   console.log(result.data); // string
 * } else {
 *   toast.error(result.error);
 * }
 * ```
 */
export async function safeInvoke<T>(
  fn: (...args: any[]) => Promise<T>,
  ...args: any[]
): Promise<IPCResult<T>> {
  try {
    const data = await fn(...args);
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const code = (error as any)?.code || "IPC_ERROR";
    console.error("[IPC Error]", message, { code, args });
    return { success: false, error: message, code };
  }
}

/**
 * Safe IPC invocation for void-returning methods
 */
export async function safeInvokeVoid(
  fn: (...args: any[]) => Promise<void>,
  ...args: any[]
): Promise<IPCResult<void>> {
  try {
    await fn(...args);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const code = (error as any)?.code || "IPC_ERROR";
    console.error("[IPC Error]", message, { code, args });
    return { success: false, error: message, code };
  }
}

export function api() {
  return (window as any).electronAPI as ElectronAPI | undefined;
}

export function isElectron(): boolean {
  return !!(window as any).electronAPI;
}

// ── License V2 Types ──────────────────────────
export interface LicenseV2Features {
  actionsUnlimited: boolean;
  multiScreen: boolean;
  premiumOverlay: boolean;
  cloudBackup: boolean;
  maxActions: number;
  maxScenes: number;
  maxOverlayPresets: number;
  maxDevices: number;
}

export interface LicenseV2Status {
  plan: 'free' | 'pro';
  status: 'active' | 'expired' | 'suspended';
  features: LicenseV2Features;
  limits: LicenseV2Features;
  expiresAt: number | null;
  isExpired: boolean;
}

export interface DeviceInfo {
  name: string;
  platform: string;
  machineId: string;
}

// Full type declarations for the IPC bridge
export interface ElectronAPI {
  // App
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getSystemTheme: () => Promise<"dark" | "light">;
  onSystemThemeChange: (cb: (theme: "dark" | "light") => void) => () => void;

  // Window
  hide: () => void;
  show: () => void;

  // External
  openExternal: (url: string) => void;
  showItemInFolder: (path: string) => void;

  // TikTok (per-screen)
  connectTikTokScreen: (screenId: string, username: string) => Promise<unknown>;
  disconnectTikTokScreen: (screenId: string) => Promise<unknown>;
  connectTikTok: (username: string) => Promise<unknown>;       // deprecated alias → screen-0
  disconnectTikTok: () => Promise<unknown>;                    // deprecated alias → screen-0
  onConnected: (cb: (data: { screenId: string; username: string; roomId: string; viewerCount: number }) => void) => () => void;
  onDisconnected: (cb: (data: { screenId: string; reason?: string }) => void) => () => void;
  onEvent: (cb: (data: { screenId: string; type: string; [key: string]: any }) => void) => () => void;
  onViewers: (cb: (data: { screenId: string; viewerCount: number }) => void) => () => void;
  onError: (cb: (data: { screenId: string; message: string }) => void) => () => void;
  onReconnecting: (cb: (data: { screenId: string; attempt: number; maxAttempts: number }) => void) => () => void;
  onRateLimited?: (cb: (data: {
    screenId: string;
    serverRetryUntil: number;
    serverRetryAfterMs: number;
  }) => void) => () => void;
  onCooldownExpired?: (cb: (data: {
    screenId: string;
    serverRetryUntil?: number;
    serverStillRateLimited?: boolean;
  }) => void) => () => void;
  onStats: (cb: (data: { screenId: string; stats: { gifts: number; likes: number; follows: number; shares: number; comments: number } }) => void) => () => void;

  // TEMPORARY: Test event injection
  injectTikTokTestEvent: (screenId: string, event: Record<string, any>) => Promise<unknown>;

  // Overlay
  openOverlay: () => void;
  closeOverlay: () => void;
  sendToOverlay: (data: any) => void;
  onOverlayEvent: (cb: (data: any) => void) => () => void;
  onOverlayConnected: (cb: (data: any) => void) => () => void;
  onOverlayDisconnected: (cb: (data: any) => void) => () => void;

  // Keystroke
  sendKeystroke: (keys: string, holdMs?: number) => Promise<boolean>;
  sendKeystrokes: (keys: string, opts?: { holdMs?: number; eventData?: any }) => void;
  onKeystrokeEvent: (cb: (data: any) => void) => () => void;

  // Global Input Hook
  startGlobalHook: (screen?: string) => Promise<{ success: boolean; running: boolean }>;
  stopGlobalHook: () => Promise<{ success: boolean }>;
  globalHookStatus: () => Promise<{ running: boolean }>;
  onGlobalHookEvent: (cb: (data: { type: string; event: string; key?: string; keyCode?: number; button?: number; direction?: string; delta?: number; screen: string }) => void) => () => void;

  // Gifts
  requestGifts: () => void;
  refreshGifts: () => void;
  onGiftList: (cb: (gifts: any[]) => void) => () => void;

  // Points
  syncPointsConfig: (config: any) => void;
  awardPoints: (data: any) => void;
  getAllUsers: () => Promise<any>;
  getUser: (username: string) => Promise<any>;
  getTopUsers: (limit: number) => Promise<any>;
  getUserCount: () => Promise<number>;
  resetAllPoints: () => void;
  halvePoints: (percent: number) => void;
  toggleChallenge: (active: boolean) => void;
  deductPoints: (opts: { username: string; amount: number }) => Promise<any>;
  clearAllPoints: () => Promise<any>;
  onPointsAwarded: (cb: (data: any) => void) => () => void;
  onPointsReset: (cb: (data: any) => void) => () => void;
  onPointsHalved: (cb: (data: any) => void) => () => void;
  onPointsChallengeToggled: (cb: (data: any) => void) => () => void;

  // OBS
  obsSetConfig: (config: any) => void;
  obsConnect: () => Promise<any>;
  obsDisconnect: () => Promise<any>;
  obsTest: (opts: { ip: string; port: number; password: string }) => Promise<{ success: boolean; error?: string }>;
  obsStatus: () => Promise<{ connected: boolean }>;
  obsSwitchScene: (opts: { sceneName: string }) => Promise<any>;
  obsGetScenes: () => Promise<any>;
  obsToggleSource: (opts: { sceneName: string; sourceName: string }) => Promise<any>;

  // Streamer.bot
  sbSetConfig: (config: any) => void;
  sbConnect: () => Promise<any>;
  sbDisconnect: () => Promise<any>;
  sbTest: (opts: { address: string; port: number; endpoint: string }) => Promise<{ success: boolean; error?: string }>;
  sbStatus: () => Promise<{ connected: boolean }>;
  sbTrigger: (opts: { actionName: string; eventData?: any }) => void;

  // Minecraft
  mcSetConfig: (config: any) => void;
  mcTest: (opts: { ip: string; port: number; password: string; mode: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
  mcStatus: () => Promise<any>;
  mcExecute: (opts: { command: string }) => Promise<any>;
  mcServer: () => Promise<any>;
  mcPlayers: () => Promise<any>;

  // License (legacy)
  licenseStatus: () => Promise<any>;
  licenseActivate: (opts: { key: string; email?: string }) => Promise<{ success: boolean; error?: string }>;
  licenseDeactivate: () => Promise<any>;
  licensePlan: () => Promise<string>;
  licenseIsPro: () => Promise<boolean>;
  licenseLimits: () => Promise<any>;
  licenseValidateAction: (count: number) => Promise<any>;
  licenseValidateSound: (count: number) => Promise<any>;
  licenseUserData: () => Promise<any>;

  // License V2 (backend-authoritative)
  licenseV2Status: (userId: string) => Promise<LicenseV2Status>;
  licenseV2Features: (userId: string) => Promise<LicenseV2Features>;
  licenseV2Activate: (userId: string, opts?: { paymentId?: string }) => Promise<{ success: boolean; plan?: string; expiresAt?: number; error?: string }>;
  licenseV2Deactivate: (userId: string) => Promise<{ success: boolean }>;
  licenseV2Extend: (userId: string, days: number) => Promise<{ success: boolean; newExpiresAt?: number; error?: string }>;
  licenseV2Suspend: (userId: string) => Promise<{ success: boolean }>;
  licenseV2Downgrade: (userId: string) => Promise<{ success: boolean }>;
  licenseV2CheckActionLimit: (userId: string, count: number) => Promise<{ allowed: boolean; limit: number; remaining: number }>;
  licenseV2CheckSceneLimit: (userId: string, count: number) => Promise<{ allowed: boolean; limit: number; remaining: number }>;
  licenseV2CheckOverlayLimit: (userId: string, count: number) => Promise<{ allowed: boolean; limit: number; remaining: number }>;
  licenseV2CheckFeature: (userId: string, feature: string) => Promise<{ allowed: boolean }>;

  // Device Management
  deviceRegister: (userId: string, info: DeviceInfo) => Promise<{ success: boolean; device?: any; requiresConfirmation?: boolean; existingDevice?: any; message?: string }>;
  deviceConfirmReplace: (userId: string, machineId: string) => Promise<{ success: boolean; device?: any }>;
  deviceList: (userId: string) => Promise<any[]>;
  deviceRemove: (userId: string, machineId: string) => Promise<{ success: boolean }>;

  // Payment
  paymentSubmit: (userId: string, data: { amount?: number; proofPath?: string }) => Promise<{ success: boolean; paymentId?: string; error?: string }>;
  paymentHistory: (userId: string) => Promise<any[]>;
  paymentPending: () => Promise<any[]>;
  paymentReview: (paymentId: string, decision: 'approve' | 'reject', adminUserId: string) => Promise<{ success: boolean; status?: string; error?: string }>;

  // Admin
  adminSearchUsers: (query: string) => Promise<any[]>;
  adminUserDetail: (userId: string) => Promise<{ user: any; license: any; devices: any[]; payments: any[]; activations: any[] } | null>;
  adminExtendLicense: (userId: string, days: number) => Promise<{ success: boolean; newExpiresAt?: number; error?: string }>;
  adminSuspendUser: (userId: string) => Promise<{ success: boolean }>;
  adminDowngradeUser: (userId: string) => Promise<{ success: boolean }>;
  adminReplaceDevice: (userId: string, machineId: string) => Promise<{ success: boolean; device?: any }>;

  // Auth
  authRegister: (opts: { email: string; password: string; name: string }) => Promise<any>;
  authLogin: (opts: { email: string; password: string; rememberMe?: boolean }) => Promise<any>;
  authGoogle: (opts: any) => Promise<any>;
  authLogout: () => Promise<any>;
  authCurrentUser: () => Promise<any>;
  authValidateSession: () => Promise<any>;
  authProfileLimit: () => Promise<any>;
  authGetProfiles: () => Promise<any>;
  authCreateProfile: (opts: any) => Promise<any>;
  authUpdateProfile: (opts: any) => Promise<any>;
  authDeleteProfile: (opts: any) => Promise<any>;
  authSetCurrentProfile: (opts: any) => Promise<any>;
  authGetCurrentProfile: () => Promise<any>;
  authExportProfile: (opts: any) => Promise<any>;
  authImportProfile: (opts: any) => Promise<any>;

  // Spotify
  spotifySetConfig: (config: any) => void;
  spotifyAuth: (opts: { clientId: string }) => Promise<{ success: boolean; error?: string }>;
  spotifyExchange: (opts: any) => Promise<any>;
  spotifyStatus: () => Promise<{ authenticated: boolean }>;
  spotifyTest: () => Promise<any>;
  spotifySearch: (opts: { query: string; limit?: number }) => Promise<any>;
  spotifyAddToQueue: (opts: { uri: string }) => Promise<any>;
  spotifySkip: () => Promise<any>;
  spotifyPlayback: () => Promise<any>;
  spotifyDevices: () => Promise<any>;
  spotifyQueue: () => Promise<any>;
  spotifyPushQueue: (opts: any) => Promise<any>;
  spotifyRemoveUser: (opts: { username: string }) => Promise<any>;
  spotifyClearQueue: () => Promise<any>;

  // Capture
  getCaptureSources: () => Promise<CaptureSource[]>;
  setCaptureSource: (sourceId: string) => Promise<{ success: boolean }>;

  // Phase 2: Diagnostics
  diagnosticsGet: () => Promise<{
    appVersion: string;
    electronVersion: string;
    nodeVersion: string;
    platform: string;
    uptime: number;
    memory: Record<string, any>;
    services: Record<string, any>;
    ipcListeners: string[];
    sseStatus: string;
  }>;
  logsExport: () => Promise<string>;
  serviceRestart: (serviceName: string) => Promise<{ success: boolean; error?: string }>;

  // Phase 5: Update
  updateCheck: (opts?: { silent?: boolean }) => Promise<{ success: boolean; updateInfo?: any; error?: string }>;
  updateDownload: () => Promise<{ success: boolean; error?: string }>;
  updateInstall: () => Promise<{ success: boolean; error?: string }>;
  updateCancel: () => Promise<{ success: boolean }>;
  updateSetChannel: (channel: string) => Promise<{ success: boolean; error?: string }>;
  updateSetPreferences: (preferences: any) => Promise<{ success: boolean }>;
  updateGetInfo: () => Promise<{
    status: string;
    currentVersion: string;
    latestVersion: string | null;
    channel: string;
    progress: any;
    currentInfo: any;
    lastCheckedAt: number | null;
  }>;
  updateGetPreferences: () => Promise<{
    channel: string;
    autoCheck: boolean;
    autoDownload: boolean;
    checkIntervalHours: number;
    silent: boolean;
  }>;
  updateSkipVersion: (version: string) => Promise<{ success: boolean }>;
  updateUnskipVersion: (version: string) => Promise<{ success: boolean }>;
  updateGetIgnored: () => Promise<string[]>;
  onUpdateStatus: (cb: (status: string) => void) => () => void;
  onUpdateProgress: (cb: (progress: any) => void) => () => void;
  onUpdateAvailable: (cb: (info: any) => void) => () => void;
  onUpdateNotAvailable: (cb: (data: { version: string }) => void) => () => void;
  onUpdateDownloaded: (cb: (info: any) => void) => () => void;
  onUpdateError: (cb: (data: { message: string; code?: string }) => void) => () => void;
  onUpdateReleaseNotes: (cb: (notes: string) => void) => () => void;

  // Cleanup
  removeAllListeners: (channel: string) => void;
}
