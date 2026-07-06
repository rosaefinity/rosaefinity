import type React from 'react';

// ─── Settings Schema (schema-driven UI) ───

export type SettingsFieldType = 'text' | 'number' | 'boolean' | 'range' | 'color' | 'select';

export interface SettingsFieldOption {
  value: string;
  label: string;
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
}

export interface SettingsSection {
  title: string;
  fields: SettingsField[];
}

export type SettingsSchema = SettingsSection[];

// ─── Overlay Module ───

export interface OverlayModule<TConfig extends Record<string, unknown>> {
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

  // Components
  renderer: React.ComponentType<RendererProps<TConfig>>;

  // Schema-driven settings
  settingsSchema: SettingsSchema;

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
  | { type: 'gift'; username: string; giftName: string; diamonds: number }
  | { type: 'follow'; username: string }
  | { type: 'like'; username: string; count: number }
  | { type: 'share'; username: string }
  | { type: 'comment'; username: string; message: string }
  | { type: 'subscribe'; username: string }
  | { type: 'goal-progress'; current: number; target: number }
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
}
