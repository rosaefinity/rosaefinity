// =============================================
// Electron Service Layer
// Typed wrapper around window.electronAPI
// =============================================

import type { CaptureSource } from "../types";

export function api() {
  return (window as any).electronAPI as ElectronAPI | undefined;
}

export function isElectron(): boolean {
  return !!(window as any).electronAPI;
}

// Full type declarations for the IPC bridge
export interface ElectronAPI {
  // App
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  getSystemTheme: () => Promise<"dark" | "light">;
  onSystemThemeChange: (cb: (theme: "dark" | "light") => void) => () => void;

  // Window
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  hide: () => void;
  show: () => void;

  // External
  openExternal: (url: string) => void;
  showItemInFolder: (path: string) => void;

  // TikTok (per-screen)
  connectTikTokScreen: (screenId: string, username: string) => void;
  disconnectTikTokScreen: (screenId: string) => void;
  connectTikTok: (username: string) => void;       // deprecated alias → screen-0
  disconnectTikTok: () => void;                    // deprecated alias → screen-0
  onConnected: (cb: (data: { screenId: string; username: string; roomId: string; viewerCount: number }) => void) => () => void;
  onDisconnected: (cb: (data: { screenId: string; reason?: string }) => void) => () => void;
  onEvent: (cb: (data: { screenId: string; type: string; [key: string]: any }) => void) => () => void;
  onViewers: (cb: (data: { screenId: string; viewerCount: number }) => void) => () => void;
  onError: (cb: (data: { screenId: string; message: string }) => void) => () => void;

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
  onPointsAwarded: (cb: (data: any) => void) => () => void;
  onPointsReset: (cb: (data: any) => void) => () => void;

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

  // License
  licenseStatus: () => Promise<any>;
  licenseActivate: (opts: { key: string; email?: string }) => Promise<{ success: boolean; error?: string }>;
  licenseDeactivate: () => Promise<any>;
  licensePlan: () => Promise<string>;
  licenseIsPro: () => Promise<boolean>;
  licenseLimits: () => Promise<any>;
  licenseValidateAction: (count: number) => Promise<any>;
  licenseValidateSound: (count: number) => Promise<any>;
  licenseUserData: () => Promise<any>;

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

  // Cleanup
  removeAllListeners: (channel: string) => void;
}
