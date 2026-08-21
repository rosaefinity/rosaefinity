// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Coin Jar Pro Module
// ─────────────────────────────────────────────────────

import { defineOverlay } from '../defineOverlay';
import { CoinJarProRenderer } from './CoinJarProRenderer';
import type { CoinJarProConfig } from './types';
import { defaultCoinJarProConfig, coinJarProSettingsSchema } from './types';
import { validateCoinJarProConfig, sanitizeCoinJarProConfig, migrateCoinJarProConfig } from './settings';
import { Target } from 'lucide-react';

export const coinJarProOverlay = defineOverlay<CoinJarProConfig>({
  id: 'coin-jar-pro',
  name: 'Coin Jar Pro',
  description: 'Watch the jar fill up with gifts as your viewers interact with you and help you reach your goal in a fun, visual way.',
  category: 'goals',
  icon: Target,
  tags: ['gift', 'goal', 'interactive', 'jar', 'coins', 'donations', 'pro'],
  supportsBrowserSource: true,
  supportsPreview: true,
  version: 1,
  configVersion: 1,
  renderer: CoinJarProRenderer,
  settingsSchema: coinJarProSettingsSchema as any,
  defaultConfig: defaultCoinJarProConfig,
  validate: validateCoinJarProConfig,
  sanitize: sanitizeCoinJarProConfig,
  migrate: migrateCoinJarProConfig,
});

export { CoinJarProRenderer } from './CoinJarProRenderer';
export * from './types';
export * from './settings';
export * from './animations';