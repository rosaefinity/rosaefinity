import { defineOverlay } from '../defineOverlay';
import React from 'react';
import { GiftAlertRenderer } from './GiftAlertRenderer';
import { Gift } from 'lucide-react';

// Import shared config types and defaults
import type {
  ColorConfig,
  AnimationConfig,
  SoundConfig,
  FontConfig,
  LayoutConfig,
  AppearanceConfig,
} from '../shared';

import {
  defaultColor,
  defaultAnimation,
  defaultSound,
  defaultFont,
  defaultLayout,
  defaultAppearance,
  colorSchemaFields,
  animationSchemaFields,
  soundSchemaFields,
  fontSchemaFields,
  layoutSchemaFields,
  appearanceSchemaFields,
} from '../shared';

/**
 * Gift Alert specific configuration
 * Extends shared configuration with gift-specific fields
 */
export interface GiftAlertConfig {
  // Shared configs
  color: ColorConfig;
  animation: AnimationConfig;
  sound: SoundConfig;
  font: FontConfig;
  layout: LayoutConfig;
  appearance: AppearanceConfig;

  // Gift-specific
  showGiftIcon: boolean;
  showGiftName: boolean;
  showUsername: boolean;
  showQuantity: boolean;
  showDiamondCount: boolean;
  giftIconSize: number;
  customGiftIcons: Record<string, string>; // giftName -> image URL
  defaultGiftIcon: string;
}

/**
 * Default Gift Alert configuration
 * Combines all shared defaults with gift-specific defaults
 */
export const defaultGiftAlertConfig: GiftAlertConfig = {
  // Shared
  color: defaultColor,
  animation: defaultAnimation,
  sound: defaultSound,
  font: defaultFont,
  layout: defaultLayout,
  appearance: defaultAppearance,

  // Gift-specific
  showGiftIcon: true,
  showGiftName: true,
  showUsername: true,
  showQuantity: true,
  showDiamondCount: false,
  giftIconSize: 48,
  customGiftIcons: {},
  defaultGiftIcon: '🎁',
};

/**
 * Settings schema for Gift Alert
 * Merges all shared schema fields with gift-specific fields
 */
export const giftAlertSettingsSchema = [
  // Appearance Section
  {
    title: 'Appearance',
    fields: [
      ...appearanceSchemaFields,
      ...colorSchemaFields,
      ...fontSchemaFields,
    ],
  },
  // Animation Section
  {
    title: 'Animation',
    fields: animationSchemaFields,
  },
  // Layout Section
  {
    title: 'Layout',
    fields: layoutSchemaFields,
  },
  // Sound Section
  {
    title: 'Sound',
    fields: soundSchemaFields,
  },
  // Gift Specific Section
  {
    title: 'Gift Display',
    fields: [
      { key: 'showGiftIcon', label: 'Show Gift Icon', type: 'boolean' as const },
      { key: 'showGiftName', label: 'Show Gift Name', type: 'boolean' as const },
      { key: 'showUsername', label: 'Show Username', type: 'boolean' as const },
      { key: 'showQuantity', label: 'Show Quantity', type: 'boolean' as const },
      { key: 'showDiamondCount', label: 'Show Diamond Count', type: 'boolean' as const },
      { key: 'giftIconSize', label: 'Gift Icon Size', type: 'range' as const, min: 24, max: 128, step: 4 },
      { key: 'defaultGiftIcon', label: 'Default Gift Icon', type: 'text' as const },
    ],
  },
] as const;

/**
 * Validate GiftAlertConfig
 */
export function validateGiftAlertConfig(config: unknown): config is GiftAlertConfig {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as Record<string, unknown>;

  // Check required shared configs
  const requiredShared = ['color', 'animation', 'sound', 'font', 'layout', 'appearance'];
  for (const key of requiredShared) {
    if (!(key in c) || typeof c[key] !== 'object' || c[key] === null) {
      return false;
    }
  }

  // Check gift-specific boolean fields
  const boolFields = ['showGiftIcon', 'showGiftName', 'showUsername', 'showQuantity', 'showDiamondCount'];
  for (const key of boolFields) {
    if (!(key in c) || typeof c[key] !== 'boolean') return false;
  }

  // Check numeric fields
  if (typeof c.giftIconSize !== 'number') return false;

  // Check string fields
  if (typeof c.defaultGiftIcon !== 'string') return false;

  // Check customGiftIcons is an object
  if (typeof c.customGiftIcons !== 'object' || c.customGiftIcons === null) return false;

  return true;
}

/**
 * Sanitize config to ensure all required fields exist with defaults
 */
export function sanitizeGiftAlertConfig(config: Record<string, unknown>): GiftAlertConfig {
  const c = config;
  return {
    color: { ...defaultColor, ...(c.color as Record<string, unknown>) },
    animation: { ...defaultAnimation, ...(c.animation as Record<string, unknown>) },
    sound: { ...defaultSound, ...(c.sound as Record<string, unknown>) },
    font: { ...defaultFont, ...(c.font as Record<string, unknown>) },
    layout: { ...defaultLayout, ...(c.layout as Record<string, unknown>) },
    appearance: { ...defaultAppearance, ...(c.appearance as Record<string, unknown>) },

    showGiftIcon: c.showGiftIcon ?? defaultGiftAlertConfig.showGiftIcon,
    showGiftName: c.showGiftName ?? defaultGiftAlertConfig.showGiftName,
    showUsername: c.showUsername ?? defaultGiftAlertConfig.showUsername,
    showQuantity: c.showQuantity ?? defaultGiftAlertConfig.showQuantity,
    showDiamondCount: c.showDiamondCount ?? defaultGiftAlertConfig.showDiamondCount,
    giftIconSize: c.giftIconSize ?? defaultGiftAlertConfig.giftIconSize,
    customGiftIcons: c.customGiftIcons as Record<string, string> ?? {},
    defaultGiftIcon: c.defaultGiftIcon ?? defaultGiftAlertConfig.defaultGiftIcon,
  };
}

/**
 * Migrate older config versions to current
 */
export function migrateGiftAlertConfig(raw: unknown, version?: number): GiftAlertConfig {
  if (!raw || typeof raw !== 'object') return defaultGiftAlertConfig;
  const c = raw as Record<string, unknown>;
  const ver = version ?? 1;

  // Version 1 is current - no migration needed
  if (ver >= 1) return sanitizeGiftAlertConfig(c);

  // Future: handle older versions
  return sanitizeGiftAlertConfig(c);
}

/**
 * Gift Alert Module Definition
 * Registers the Gift Alert overlay in the registry
 */
export const giftAlertOverlay = defineOverlay<GiftAlertConfig>({
  id: 'gift-alert',
  name: 'Gift Alert',
  description: 'A visual alert displayed when a TikTok LIVE gift event occurs.',
  category: 'alerts',
  icon: Gift,
  tags: ['gift', 'donation', 'alert', 'animation'],
  supportsBrowserSource: true,
  supportsPreview: true,
  version: 1,
  configVersion: 1,
  renderer: GiftAlertRenderer,
  settingsSchema: giftAlertSettingsSchema as any, // Cast to satisfy SettingsSchema type
  defaultConfig: defaultGiftAlertConfig,
  validate: validateGiftAlertConfig,
  sanitize: sanitizeGiftAlertConfig,
  migrate: migrateGiftAlertConfig,
});