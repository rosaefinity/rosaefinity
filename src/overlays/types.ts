import type React from 'react';

// ─── Settings Schema (schema-driven UI) ───

export type SettingsFieldType = 'text' | 'number' | 'boolean' | 'range' | 'color' | 'select' | 'switch' | 'slider' | 'animation' | 'duration' | 'font';

export interface SettingsFieldOption {
  value: string;
  label: string;
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: unknown;
  message: string;
  validator?: (value: unknown) => boolean;
}

export interface SettingsField {
  key: string;
  label: string;
  type: SettingsFieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: SettingsFieldOption[];
  placeholder?: string;
  description?: string;
  section?: string;
  dependsOn?: { key: string; value: unknown; operator?: string };
  validation?: ValidationRule[];
}

export interface SettingsSection {
  title: string;
  fields: SettingsField[];
}

export type SettingsSchema = SettingsSection[];

// ─── Base Overlay Config (runtime config shape) ───

/** Point position (x, y) */
export interface OverlayPosition {
  x: number;
  y: number;
}

/** Size (width, height) */
export interface OverlaySize {
  width: number;
  height: number;
}

/** Border configuration */
export interface BaseOverlayBorder {
  width: number;
  color: string;
  radius: number;
}

/** Shadow configuration */
export interface BaseOverlayShadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

/** Spacing (padding / margin) */
export interface BaseOverlaySpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Color palette for overlays */
export interface BaseOverlayColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
}

/** Text shadow configuration */
export interface TextShadowConfig {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Complete base configuration for all overlays.
 * Every overlay renderer receives a config extending this shape.
 * Created at runtime by createOverlayConfig() from module defaults.
 */
export interface BaseOverlayConfig {
  // ── Visibility ──
  enabled: boolean;
  visible: boolean;

  // ── Layout ──
  position: OverlayPosition;
  size: OverlaySize;
  scale: number;
  rotation: number;
  opacity: number;
  zIndex?: number;

  // ── Animation ──
  animationSpeed: number;
  animationDuration: number;
  animationDelay: number;
  animationEasing: string;
  animationLoop: boolean;
  transition: string;

  // ── Typography ──
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
  textAlign: 'left' | 'center' | 'right';
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textShadow: TextShadowConfig;

  // ── Colors ──
  colors: BaseOverlayColors;

  // ── Border ──
  border: BaseOverlayBorder;

  // ── Shadow ──
  shadow: BaseOverlayShadow;

  // ── Spacing ──
  padding: BaseOverlaySpacing;
  margin: BaseOverlaySpacing;

  // ── Behavior ──
  duration: number;
  maxItems: number;
  cooldown: number;
  hiddenWhenInactive: boolean;
  autoHide: boolean;
  autoHideDelay: number;
  autoPlay: boolean;
  clickThrough: boolean;
  lockPosition: boolean;

  // ── Audio ──
  soundEnabled: boolean;
  soundUrl: string;
  soundVolume: number;

  // ── Screen ──
  screenId: string;
}

// ─── Overlay Module ───

export interface OverlayModule<TConfig extends object = Record<string, unknown>> {
  // Metadata
  id: string;
  name: string;
  description: string;
  category: 'alerts' | 'goals' | 'chat' | 'events' | 'graphics';
  icon: React.ComponentType<{ className?: string }>;
  thumbnail?: string;
  tags: string[];
  supportsBrowserSource: boolean;
  supportsPreview: boolean;
  version: number;

  // Metadata for Studio/Preview consumers
  metadata?: OverlayMetadata;

  // Components
  renderer: React.ComponentType<RendererProps<TConfig>>;

  // Schema-driven settings
  settingsSchema: SettingsSchema | SettingsField[];

  // Configuration
  defaultConfig: TConfig;
  configVersion: number;
  validate: (config: unknown) => config is TConfig;
  sanitize: (config: Record<string, unknown>) => TConfig;
  migrate: (raw: unknown, version?: number) => TConfig;

  // Lifecycle (optional)
  onCreate?: (context: OverlayContext) => void;
  onDestroy?: (context: OverlayContext) => void;
  onEvent?: (context: OverlayContext, event: OverlayEvent) => void;
}

// ─── Overlay Metadata (for Studio/Preview consumers) ───

export interface OverlayMetadata {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  icon?: React.ComponentType<{ className?: string }>;
  version?: string | number;
  configVersion?: number;
  supportsBrowserSource?: boolean;
  supportsPreview?: boolean;

  // Preserve legacy metadata fields
  author?: string;
  thumbnail?: string;
  previewImage?: string;
  beta?: boolean;
  featured?: boolean;
  hidden?: boolean;
  premium?: boolean;
  deprecated?: boolean;
  requiresLicense?: boolean;
  licenseTier?: string;
  supportsOBS?: boolean;
  supportsMultiScreen?: boolean;
  supportsThemes?: boolean;
  supportsTikTokLiveStudio?: boolean;
  minimumVersion?: string;
  maximumVersion?: string | null;
  platform?: string;

  [key: string]: unknown;
}

// ─── Overlay Input Types (for defineOverlay) ───

export interface FlatOverlayInput<TConfig extends object = Record<string, unknown>> {
  // Metadata (flat)
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  tags: string[];
  supportsBrowserSource: boolean;
  supportsPreview: boolean;
  version: number;

  // Components
  renderer: React.ComponentType<RendererProps<TConfig>>;

  // Schema-driven settings
  settingsSchema: SettingsSchema | SettingsField[];

  // Configuration
  defaultConfig: TConfig;
  configVersion: number;
  validate: (config: unknown) => config is TConfig;
  sanitize: (config: Record<string, unknown>) => TConfig;
  migrate: (raw: unknown, version?: number) => TConfig;

  // Optional metadata (for Studio consumers)
  metadata?: OverlayMetadata;

  // Lifecycle (optional)
  onCreate?: (context: OverlayContext) => void;
  onDestroy?: (context: OverlayContext) => void;
  onEvent?: (context: OverlayContext, event: OverlayEvent) => void;
}

export interface LegacyOverlayInput<TConfig extends object = Record<string, unknown>> {
  // Nested metadata structure
  metadata: {
    id: string;
    name: string;
    description: string;
    category: string;
    tags: string[];
    icon: React.ComponentType<any>;
    version: string;
    configVersion: number;
    supportsBrowserSource: boolean;
    supportsPreview: boolean;
    author?: string;
    thumbnail?: string;
    previewImage?: string;
    beta?: boolean;
    featured?: boolean;
    hidden?: boolean;
    premium?: boolean;
    deprecated?: boolean;
    requiresLicense?: boolean;
    licenseTier?: string;
    supportsOBS?: boolean;
    supportsMultiScreen?: boolean;
    supportsThemes?: boolean;
    supportsTikTokLiveStudio?: boolean;
    minimumVersion?: string;
    maximumVersion?: string | null;
    platform?: string;
    [key: string]: unknown;
  };

  // Components
  renderer: React.ComponentType<RendererProps<TConfig>>;

  // Schema-driven settings
  settingsSchema: SettingsSchema | SettingsField[];

  // Configuration
  defaultConfig: TConfig;

  // Legacy function names
  validateConfig: (config: unknown) => config is TConfig;
  sanitizeConfig: (config: Record<string, unknown>) => TConfig;
  migrateConfig: (raw: unknown, version?: number) => TConfig;

  // Legacy extra field (not consumed at runtime)
  eventTypes?: string[];
}

// Union type for defineOverlay input
export type OverlayInput<TConfig extends object = Record<string, unknown>> =
  | FlatOverlayInput<TConfig>
  | LegacyOverlayInput<TConfig>;

// ─── Renderer Props ───

export interface RendererProps<TConfig> {
  config: TConfig;
  mode: 'preview' | 'browser-source';
  events?: OverlayEventSource;
  size?: { width: number; height: number };
}

// ─── Overlay Context ───

export interface OverlayContext {
  instanceId: string;
  moduleId: string;
  config: Record<string, unknown>;
  setConfig: (config: Record<string, unknown>) => void;
}

// ─── Events ───

export type OverlayEvent =
  | { type: 'gift'; username: string; giftName: string; diamonds: number; repeatCount?: number; giftImageUrl?: string; giftId?: string }
  | { type: 'follow'; username: string }
  | { type: 'like'; username: string; count: number; totalLikes?: number }
  | { type: 'share'; username: string }
  | { type: 'comment'; username: string; message: string }
  | { type: 'subscribe'; username: string }
  | { type: 'goal-progress'; current: number; target: number; goalType?: string; goalId?: string; title?: string; barColor?: string; reached?: boolean }
  | { type: 'hotkey'; keys: string }
  | { type: 'custom'; data: Record<string, unknown> };

export interface OverlayEventSource {
  subscribe(callback: (event: OverlayEvent) => void): () => void;
}

// ─── Registry Types ───

export type AnyOverlayModule = OverlayModule<Record<string, unknown>>;

// ─── Overlay Instance ───

export interface OverlayInstance {
  id: string;
  moduleId: string;
  name: string;
  enabled: boolean;
  browserSourceId: string;
  config: Record<string, unknown>;
  configVersion: number;
  createdAt: number;
  updatedAt: number;
  userId?: string; // Account owner — assigned on create/remote-apply
  profileId?: string; // Stream Profile owner — assigned on create/migration
}

// ─── Transport Types ───

/** Callback type for overlay transport message handlers. */
export type MessageHandler = (data: unknown) => void;
