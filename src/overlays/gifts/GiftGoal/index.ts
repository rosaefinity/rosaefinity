import { defineOverlay } from '../../defineOverlay';
import { GiftGoalComponent } from './Component';
import { giftGoalSchema, giftGoalDefaults } from './settings';
import type { GiftGoalConfig } from './types';
import { Target } from 'lucide-react';

export const GiftGoalOverlay = defineOverlay<GiftGoalConfig>({
  metadata: {
    id: 'gift-goal', name: 'Gift Goal', description: 'Gift diamond goal progress bar',
    category: 'gifts', tags: ['gifts', 'goal', 'progress', 'diamonds'],
    author: 'RosaeFinity', version: '1.0.0', icon: Target,
    thumbnail: '', previewImage: '', beta: false, featured: true, hidden: false,
    premium: false, deprecated: false, requiresLicense: false, licenseTier: 'free',
    supportsOBS: true, supportsBrowserSource: true, supportsMultiScreen: true,
    supportsThemes: true, supportsTikTokLiveStudio: true,
    minimumVersion: '1.0.0', maximumVersion: null, platform: 'all', configVersion: 1,
  },
  renderer: GiftGoalComponent, settingsSchema: giftGoalSchema,
  defaultConfig: giftGoalDefaults as unknown as GiftGoalConfig,
  validateConfig: (c): c is GiftGoalConfig => typeof c === 'object' && c !== null && 'target' in c,
  sanitizeConfig: (c) => ({ ...giftGoalDefaults, ...c }) as GiftGoalConfig,
  migrateConfig: (raw) => (raw as GiftGoalConfig) ?? giftGoalDefaults as GiftGoalConfig,
  eventTypes: ['gift'],
});
