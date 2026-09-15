// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Coin Jar Pro Types
// ─────────────────────────────────────────────────────

import type { SettingsField } from '../types';

/**
 * Coin Jar Pro specific configuration
 * Extends shared configuration with coin jar specific fields
 */
export interface CoinJarProConfig {
  // Shared configs
  color: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
  animation: {
    entrance: 'fade' | 'slide-up' | 'slide-left' | 'scale' | 'none';
    exit: 'fade' | 'slide-up' | 'slide-left' | 'scale' | 'none';
    duration: number;
    easing: string;
  };
  sound: {
    enabled: boolean;
    soundUrl: string;
    volume: number;
    repeat: number;
  };
  font: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
  };
  layout: {
    position: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    alignment: 'left' | 'center' | 'right';
    padding: number;
    maxWidth: number;
  };
  appearance: {
    opacity: number;
    borderRadius: number;
    border: string;
    boxShadow: string;
    background: string;
  };

  // Coin Jar Pro specific
  goalCoins: number;
  showGoal: boolean;
  showTotalCoins: boolean;
  showDonorNotification: boolean;
  jarScale: number;
  jarPositionX: number;
  jarPositionY: number;
  notificationPosition: 'top' | 'bottom' | 'side';
  fillStyle: 'gradient' | 'solid' | 'animated';
  giftAnimation: 'drop' | 'float' | 'bounce' | 'slide';
  animationDuration: number;
  particleAmount: number;
  notificationDuration: number;
  donorText: string;
  giftText: string;
  coinText: string;
  showAvatar: boolean;
  showGiftIcon: boolean;
  showCoinIcon: boolean;
  continueAfterGoal: boolean;
}

/**
 * Default Coin Jar Pro configuration
 */
export const defaultCoinJarProConfig: CoinJarProConfig = {
  // Shared
  color: {
    primary: '#7C3AED',
    secondary: '#EC4899',
    background: 'transparent',
    text: '#FFFFFF',
    accent: '#A78BFA',
  },
  animation: {
    entrance: 'scale',
    exit: 'fade',
    duration: 500,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  sound: {
    enabled: true,
    soundUrl: '',
    volume: 0.8,
    repeat: 1,
  },
  font: {
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.4,
  },
  layout: {
    position: 'center',
    alignment: 'center',
    padding: 16,
    maxWidth: 420,
  },
  appearance: {
    opacity: 1,
    borderRadius: 12,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)',
    background: 'rgba(20, 20, 30, 0.88)',
  },

  // Coin Jar Pro specific
  goalCoins: 1000,
  showGoal: true,
  showTotalCoins: true,
  showDonorNotification: true,
  jarScale: 1,
  jarPositionX: 0,
  jarPositionY: 0,
  notificationPosition: 'bottom',
  fillStyle: 'gradient',
  giftAnimation: 'drop',
  animationDuration: 800,
  particleAmount: 8,
  notificationDuration: 3000,
  donorText: '{avatar} {username} donated',
  giftText: '💗 {giftName} x{count} ({coins} Coins)',
  coinText: '🪙 {coins}',
  showAvatar: true,
  showGiftIcon: true,
  showCoinIcon: true,
  continueAfterGoal: false,
};

/**
 * Settings schema for Coin Jar Pro
 */
export const coinJarProSettingsSchema: SettingsField[] = [
  // General Section
  {
    title: 'General',
    fields: [
      { key: 'goalCoins', label: 'Goal Coins', type: 'number', min: 1, section: 'Goal' },
      { key: 'showGoal', label: 'Show Goal', type: 'boolean', section: 'Display' },
      { key: 'showTotalCoins', label: 'Show Total Coins', type: 'boolean', section: 'Display' },
      { key: 'showDonorNotification', label: 'Show Donor Notification', type: 'boolean', section: 'Display' },
      { key: 'continueAfterGoal', label: 'Continue Filling After Goal', type: 'boolean', section: 'Behavior' },
    ],
  },
  // Appearance Section
  {
    title: 'Appearance',
    fields: [
      { key: 'jarScale', label: 'Jar Scale', type: 'range', min: 0.5, max: 2, step: 0.05, section: 'Jar' },
      { key: 'jarPositionX', label: 'Jar Position X', type: 'range', min: -100, max: 100, step: 1, section: 'Jar' },
      { key: 'jarPositionY', label: 'Jar Position Y', type: 'range', min: -100, max: 100, step: 1, section: 'Jar' },
      { key: 'notificationPosition', label: 'Notification Position', type: 'select', options: [
        { value: 'top', label: 'Top' },
        { value: 'bottom', label: 'Bottom' },
        { value: 'side', label: 'Side' },
      ], section: 'Notifications' },
      { key: 'fillStyle', label: 'Fill Style', type: 'select', options: [
        { value: 'gradient', label: 'Gradient' },
        { value: 'solid', label: 'Solid' },
        { value: 'animated', label: 'Animated' },
      ], section: 'Fill' },
    ],
  },
  // Animation Section
  {
    title: 'Animation',
    fields: [
      { key: 'giftAnimation', label: 'Gift Animation', type: 'select', options: [
        { value: 'drop', label: 'Drop' },
        { value: 'float', label: 'Float' },
        { value: 'bounce', label: 'Bounce' },
        { value: 'slide', label: 'Slide' },
      ], section: 'Gift' },
      { key: 'animationDuration', label: 'Animation Duration (ms)', type: 'range', min: 200, max: 2000, step: 50, section: 'Timing' },
      { key: 'particleAmount', label: 'Particle Amount', type: 'range', min: 1, max: 20, step: 1, section: 'Particles' },
      { key: 'notificationDuration', label: 'Notification Duration (ms)', type: 'range', min: 1000, max: 10000, step: 500, section: 'Notifications' },
    ],
  },
  // Text Section
  {
    title: 'Text',
    fields: [
      { key: 'donorText', label: 'Donor Text Template', type: 'text', section: 'Templates' },
      { key: 'giftText', label: 'Gift Text Template', type: 'text', section: 'Templates' },
      { key: 'coinText', label: 'Coin Text Template', type: 'text', section: 'Templates' },
    ],
  },
  // Display Options Section
  {
    title: 'Display Options',
    fields: [
      { key: 'showAvatar', label: 'Show Avatar', type: 'boolean', section: 'Elements' },
      { key: 'showGiftIcon', label: 'Show Gift Icon', type: 'boolean', section: 'Elements' },
      { key: 'showCoinIcon', label: 'Show Coin Icon', type: 'boolean', section: 'Elements' },
    ],
  },
  // Shared configs
  {
    title: 'Colors',
    fields: [
      { key: 'color.primary', label: 'Primary Color', type: 'color' },
      { key: 'color.secondary', label: 'Secondary Color', type: 'color' },
      { key: 'color.background', label: 'Background', type: 'text' },
      { key: 'color.text', label: 'Text Color', type: 'color' },
      { key: 'color.accent', label: 'Accent Color', type: 'color' },
    ],
  },
  {
    title: 'Animation',
    fields: [
      { key: 'animation.entrance', label: 'Entrance', type: 'select', options: [
        { value: 'fade', label: 'Fade' },
        { value: 'slide-up', label: 'Slide Up' },
        { value: 'slide-left', label: 'Slide Left' },
        { value: 'scale', label: 'Scale' },
        { value: 'none', label: 'None' },
      ]},
      { key: 'animation.exit', label: 'Exit', type: 'select', options: [
        { value: 'fade', label: 'Fade' },
        { value: 'slide-up', label: 'Slide Up' },
        { value: 'slide-left', label: 'Slide Left' },
        { value: 'scale', label: 'Scale' },
        { value: 'none', label: 'None' },
      ]},
      { key: 'animation.duration', label: 'Duration (ms)', type: 'range', min: 100, max: 2000, step: 50 },
      { key: 'animation.easing', label: 'Easing', type: 'text' },
    ],
  },
  {
    title: 'Layout',
    fields: [
      { key: 'layout.position', label: 'Position', type: 'select', options: [
        { value: 'top-left', label: 'Top Left' },
        { value: 'top-center', label: 'Top Center' },
        { value: 'top-right', label: 'Top Right' },
        { value: 'center', label: 'Center' },
        { value: 'bottom-left', label: 'Bottom Left' },
        { value: 'bottom-center', label: 'Bottom Center' },
        { value: 'bottom-right', label: 'Bottom Right' },
      ]},
      { key: 'layout.alignment', label: 'Alignment', type: 'select', options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ]},
      { key: 'layout.padding', label: 'Padding', type: 'range', min: 0, max: 64, step: 1 },
      { key: 'layout.maxWidth', label: 'Max Width', type: 'range', min: 100, max: 1200, step: 10 },
    ],
  },
  {
    title: 'Font',
    fields: [
      { key: 'font.fontFamily', label: 'Font Family', type: 'text' },
      { key: 'font.fontSize', label: 'Font Size', type: 'range', min: 8, max: 72, step: 1 },
      { key: 'font.fontWeight', label: 'Font Weight', type: 'range', min: 100, max: 900, step: 100 },
      { key: 'font.lineHeight', label: 'Line Height', type: 'range', min: 0.8, max: 2.5, step: 0.1 },
    ],
  },
  {
    title: 'Sound',
    fields: [
      { key: 'sound.enabled', label: 'Enable Sound', type: 'boolean' },
      { key: 'sound.soundUrl', label: 'Sound URL', type: 'text' },
      { key: 'sound.volume', label: 'Volume', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'sound.repeat', label: 'Repeat', type: 'number', min: 1, max: 10 },
    ],
  },
  {
    title: 'Appearance',
    fields: [
      { key: 'appearance.opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'appearance.borderRadius', label: 'Border Radius', type: 'range', min: 0, max: 50, step: 1 },
      { key: 'appearance.border', label: 'Border', type: 'text' },
      { key: 'appearance.boxShadow', label: 'Box Shadow', type: 'text' },
      { key: 'appearance.background', label: 'Background', type: 'text' },
    ],
  },
] as const;

/**
 * Recent gift notification data
 */
export interface RecentGift {
  username: string;
  avatarUrl?: string;
  giftName: string;
  giftImageUrl?: string;
  giftCount: number;
  coinValue: number;
  timestamp: number;
}

/**
 * Donor data
 */
export interface Donor {
  username: string;
  avatarUrl?: string;
  totalCoins: number;
  lastGift: RecentGift;
}

/**
 * Coin Jar Pro runtime state
 */
export interface CoinJarState {
  totalCoins: number;
  goalCoins: number;
  currentFill: number;
  recentGift?: RecentGift;
  donors: Donor[];
  particles: Particle[]; // Legacy particles
  fallingGifts: FallingGift[]; // New falling gift animation system
  accumulatedGifts: AccumulatedGift[]; // New accumulated gift pile system
}

/**
 * Animated particle inside the jar (legacy - for backward compatibility)
 */
export interface Particle {
  id: string;
  type: 'coin' | 'heart' | 'gift' | 'flower';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number;
  rotation: number;
  opacity: number;
  animationState: 'entering' | 'settling' | 'idle';
}

/**
 * Falling gift animation object
 */
export interface FallingGift {
  id: string;
  type: 'coin' | 'heart' | 'gift' | 'flower' | 'diamond';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number;
  rotation: number;
  velocity: { x: number; y: number };
  phase: 'spawn' | 'fall' | 'enter' | 'bounce' | 'settle';
  giftData: RecentGift;
  startTime: number;
}

/**
 * Accumulated gift at the bottom of the jar
 */
export interface AccumulatedGift {
  id: string;
  type: 'coin' | 'heart' | 'gift' | 'flower' | 'diamond';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number;
  rotation: number;
  opacity: number;
  giftData: RecentGift;
  /** Direct reference to image URL — survives state batching without relying on giftData nested reference */
  giftImageUrl: string;
  /** Gift name — direct reference for rendering */
  giftName: string;
  timestamp: number;
  settled: boolean;
}