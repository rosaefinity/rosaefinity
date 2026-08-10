// =============================================
// RosaeFinity Type Definitions - Complete
// =============================================

export type AuthProvider = "email" | "google";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: AuthProvider;
  plan: "free" | "pro";
  createdAt: string;
  lastLogin: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

// ===== Actions =====
export interface ActionAdvancedSettings {
  displayDuration: number;
  mediaVolume: number;
  overlayScreen: string;
  globalCooldown: number;
  userCooldown: number;
  fadeInOut: boolean;
  repeatCombo: boolean;
  skipNext: boolean;
}

export interface Action {
  id: string;
  name: string;
  screen: string;
  duration: number;
  sound: boolean;
  soundFile?: string;
  soundFileName?: string;
  video: boolean;
  videoFile?: string;
  videoFileName?: string;
  image: boolean;
  imageFile?: string;
  imageFileName?: string;
  keystroke: boolean;
  keystrokeKeys?: string;
  keystrokeHoldMs?: number;
  minecraft: boolean;
  minecraftCommand?: string;
  enabled: boolean;
  displayDuration?: number;
  mediaVolume?: number;
  overlayScreen?: string;
  globalCooldown?: number;
  userCooldown?: number;
  fadeInOut?: boolean;
  repeatCombo?: boolean;
  skipNext?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== Events =====
export type EventTriggerType =
  | "gift" | "specificgift" | "giftcoins"
  | "follow" | "like" | "comment" | "join"
  | "firstactivity" | "command" | "subscribe"
  | "subemote" | "fansclub" | "shop";

export type WhoTrigger = "any" | "anyfollower" | "anysubscriber" | "anymoderator" | "topgifter" | "specificuser";

export interface Event {
  id: string;
  triggerType: EventTriggerType;
  whoTrigger: WhoTrigger;
  specificUser?: string;
  giftName?: string;
  minCoins?: number;
  minLikes?: number;
  keyword?: string;
  actionName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== Sounds =====
export interface CustomSound {
  id: string;
  name: string;
  fileName: string;
  file: string; // dataURL
  enabled: boolean;
  createdAt: string;
}

export interface SoundVolumeSettings {
  masterVolume: number;
  individualVolumes: Record<string, number>;
}

// ===== TikTok Gifts =====
export interface TikTokGift {
  name: string;
  coins: number;
  image?: string;
  cdnImage?: string;
  imageHash?: string;
  giftId?: string;
  id?: string;
}

// ===== Stats =====
export interface Stats {
  gifts: number;
  likes: number;
  views: number;
  follows: number;
}

// ===== Screen Connection (Multi-Screen v2) =====
export type ScreenId = string; // "screen-0" through "screen-7"

export const SCREEN_IDS: ScreenId[] = [
  "screen-0", "screen-1", "screen-2", "screen-3",
  "screen-4", "screen-5", "screen-6", "screen-7",
];

export type TikTokConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ScreenConnectionState {
  screenId: ScreenId;
  isLive: boolean;
  username: string;
  roomId: string;
  viewerCount: number;
  status: TikTokConnectionStatus;
  lastError?: string;
  reconnectAttempts: number;
  isReconnecting: boolean;
  stats: Stats;
}

// ===== Live Event =====
export interface LiveEvent {
  type: "gift" | "follow" | "comment" | "like" | "share" | "join" | "subscribe";
  screenId?: ScreenId;
  user: string;
  nickname?: string;
  giftName?: string;
  repeatCount?: number;
  diamondCount?: number;
  comment?: string;
  likeCount?: number;
  totalLikeCount?: number;
  profilePictureUrl?: string;
  timestamp: number;
}

// ===== TikTok Connection =====

export interface TikTokConnectionState {
  status: TikTokConnectionStatus;
  username: string;
  roomId: string;
  viewerCount: number;
  stats: Stats;
  lastError?: string;
  reconnectAttempts: number;
  isReconnecting: boolean;
}

// ===== Settings / Setup Config =====
export interface SetupConfig {
  tikTokName: string;
  screenTikTokNames: Record<ScreenId, string>;
  currencyName: string;
  pointsGift: number;
  pointsLike: number;
  pointsFollow: number;
  pointsComment: number;
  pointsShare: number;
  pointsSubscribe: number;
  subBonus: number;
  levelPoints: number;
  levelMultiplier: number;
  obsIp: string;
  obsPort: number;
  obsPassword: string;
  sbAddress: string;
  sbPort: number;
  sbEndpoint: string;
  mcIp: string;
  mcPort: number;
  mcPassword: string;
  mcMode: string;
  mcPlayer: string;
  spotifyEnabled: boolean;
  spotifyClientId: string;
  tikTokLang: string;
  debugMode: boolean;
  playEnabled: boolean;
  playCost: number;
  skipEnabled: boolean;
  skipCost: number;
  skipRequestedEnabled: boolean;
  explicitEnabled: boolean;
  maxQueueOverall: number;
  maxQueuePerUser: number;
  overlayPermanent: boolean;
}

// ===== License =====
export interface LicenseInfo {
  isPro: boolean;
  plan: "free" | "pro";
  limits: {
    actions: number;
    customSounds: number;
    streamProfiles: number;
  };
  expiresAt?: string;
  licenseKey?: string;
}

// ===== Overlay =====
export interface OverlayConfig {
  theme: "light" | "dark";
  primaryColor: string;
  secondaryColor: string;
  transparency: number;
  scale: number;
  borderRadius: number;
  animationSpeed: "slow" | "normal" | "fast";
}

export type OverlayCategory =
  | "all" | "gift" | "alert" | "goal" | "game" | "interactive"
  | "sports" | "music" | "trending" | "premium" | "favorite";

export interface FilterTab {
  id: OverlayCategory;
  label: string;
  icon: string;
}

// ===== Spotify =====
export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  albumArt: string;
  uri: string;
}

export interface SpotifyQueueEntry {
  user: string;
  nickname: string;
  track: SpotifyTrack;
  timestamp: number;
}

// ===== Notifications =====
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
}

// ===== Stream Profiles =====
export interface StreamProfile {
  id: string;
  name: string;
  tiktokUsername: string;
  overlaySettings: any;
  alertsSettings: any;
  actions: Action[];
  events: Event[];
  createdAt: string;
  updatedAt: string;
}

// ===== Alert Settings =====
export interface AlertEventConfig {
  event: string;
  enabled: boolean;
  minDiamond?: number;
  minLikes?: number;
  duration: number;
  sound?: string;
  color?: string;
  keyword?: string;
}

// ===== Points System =====
export interface PointsUser {
  username: string;
  name: string;
  points: number;
  level: number;
  giftCount: number;
  likeCount: number;
  followCount: number;
  commentCount: number;
  shareCount: number;
  firstSeen: number;
  lastSeen: number;
}

export interface PointsConfig {
  currencyName: string;
  pointsGift: number;
  pointsLike: number;
  pointsFollow: number;
  pointsComment: number;
  pointsShare: number;
  subBonus: number;
  levelPoints: number;
  levelMultiplier: number;
}

// ===== Screen Capture =====
export interface CaptureSource {
  id: string;
  name: string;
  thumbnailDataURL: string;
  display_id: string;
  appIcon: string | null;
}
