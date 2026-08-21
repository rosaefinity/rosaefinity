// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Coin Jar Pro Settings
// ─────────────────────────────────────────────────────

import type { CoinJarProConfig } from './types';
import { defaultCoinJarProConfig } from './types';

/**
 * Validate CoinJarProConfig
 */
export function validateCoinJarProConfig(config: unknown): config is CoinJarProConfig {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as Record<string, unknown>;

  // Check required shared configs
  const requiredShared = ['color', 'animation', 'sound', 'font', 'layout', 'appearance'];
  for (const key of requiredShared) {
    if (!(key in c) || typeof c[key] !== 'object' || c[key] === null) {
      return false;
    }
  }

  // Check coin jar specific fields
  const requiredFields: Array<[string, 'number' | 'boolean' | 'string']> = [
    ['goalCoins', 'number'],
    ['showGoal', 'boolean'],
    ['showTotalCoins', 'boolean'],
    ['showDonorNotification', 'boolean'],
    ['jarScale', 'number'],
    ['jarPositionX', 'number'],
    ['jarPositionY', 'number'],
    ['notificationPosition', 'string'],
    ['fillStyle', 'string'],
    ['giftAnimation', 'string'],
    ['animationDuration', 'number'],
    ['particleAmount', 'number'],
    ['notificationDuration', 'number'],
    ['donorText', 'string'],
    ['giftText', 'string'],
    ['coinText', 'string'],
    ['showAvatar', 'boolean'],
    ['showGiftIcon', 'boolean'],
    ['showCoinIcon', 'boolean'],
    ['continueAfterGoal', 'boolean'],
  ];

  for (const [key, type] of requiredFields) {
    if (!(key in c) || typeof c[key] !== type) return false;
  }

  // Validate enum values
  const validNotificationPositions = ['top', 'bottom', 'side'];
  if (!validNotificationPositions.includes(c.notificationPosition as string)) return false;

  const validFillStyles = ['gradient', 'solid', 'animated'];
  if (!validFillStyles.includes(c.fillStyle as string)) return false;

  const validGiftAnimations = ['drop', 'float', 'bounce', 'slide'];
  if (!validGiftAnimations.includes(c.giftAnimation as string)) return false;

  return true;
}

/**
 * Sanitize config to ensure all required fields exist with defaults
 */
export function sanitizeCoinJarProConfig(config: Record<string, unknown>): CoinJarProConfig {
  const c = config;
  return {
    color: { ...defaultCoinJarProConfig.color, ...(c.color as Record<string, unknown>) },
    animation: { ...defaultCoinJarProConfig.animation, ...(c.animation as Record<string, unknown>) },
    sound: { ...defaultCoinJarProConfig.sound, ...(c.sound as Record<string, unknown>) },
    font: { ...defaultCoinJarProConfig.font, ...(c.font as Record<string, unknown>) },
    layout: { ...defaultCoinJarProConfig.layout, ...(c.layout as Record<string, unknown>) },
    appearance: { ...defaultCoinJarProConfig.appearance, ...(c.appearance as Record<string, unknown>) },

    goalCoins: c.goalCoins ?? defaultCoinJarProConfig.goalCoins,
    showGoal: c.showGoal ?? defaultCoinJarProConfig.showGoal,
    showTotalCoins: c.showTotalCoins ?? defaultCoinJarProConfig.showTotalCoins,
    showDonorNotification: c.showDonorNotification ?? defaultCoinJarProConfig.showDonorNotification,
    jarScale: c.jarScale ?? defaultCoinJarProConfig.jarScale,
    jarPositionX: c.jarPositionX ?? defaultCoinJarProConfig.jarPositionX,
    jarPositionY: c.jarPositionY ?? defaultCoinJarProConfig.jarPositionY,
    notificationPosition: c.notificationPosition ?? defaultCoinJarProConfig.notificationPosition,
    fillStyle: c.fillStyle ?? defaultCoinJarProConfig.fillStyle,
    giftAnimation: c.giftAnimation ?? defaultCoinJarProConfig.giftAnimation,
    animationDuration: c.animationDuration ?? defaultCoinJarProConfig.animationDuration,
    particleAmount: c.particleAmount ?? defaultCoinJarProConfig.particleAmount,
    notificationDuration: c.notificationDuration ?? defaultCoinJarProConfig.notificationDuration,
    donorText: c.donorText ?? defaultCoinJarProConfig.donorText,
    giftText: c.giftText ?? defaultCoinJarProConfig.giftText,
    coinText: c.coinText ?? defaultCoinJarProConfig.coinText,
    showAvatar: c.showAvatar ?? defaultCoinJarProConfig.showAvatar,
    showGiftIcon: c.showGiftIcon ?? defaultCoinJarProConfig.showGiftIcon,
    showCoinIcon: c.showCoinIcon ?? defaultCoinJarProConfig.showCoinIcon,
    continueAfterGoal: c.continueAfterGoal ?? defaultCoinJarProConfig.continueAfterGoal,
  };
}

/**
 * Migrate older config versions to current
 */
export function migrateCoinJarProConfig(raw: unknown, version?: number): CoinJarProConfig {
  if (!raw || typeof raw !== 'object') return defaultCoinJarProConfig;
  const c = raw as Record<string, unknown>;
  const ver = version ?? 1;

  // Version 1 is current - no migration needed
  if (ver >= 1) return sanitizeCoinJarProConfig(c);

  // Future: handle older versions
  return sanitizeCoinJarProConfig(c);
}