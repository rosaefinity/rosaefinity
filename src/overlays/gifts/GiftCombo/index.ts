import { defineOverlay } from '../../defineOverlay';
import { GiftComboComponent } from './Component';
import { giftComboSchema, giftComboDefaults } from './settings';
import type { GiftComboConfig } from './types';
import { Flame } from 'lucide-react';

export const GiftComboOverlay = defineOverlay<GiftComboConfig>({
  metadata: {
    id: 'gift-combo', name: 'Gift Combo', description: 'Live combo counter for consecutive gifts',
    category: 'gifts', tags: ['gifts', 'combo', 'counter', 'streak'],
    author: 'RosaeFinity', version: '1.0.0', icon: Flame,
    thumbnail: '', previewImage: '', beta: false, featured: false, hidden: false,
    premium: false, deprecated: false, requiresLicense: false, licenseTier: 'free',
    supportsOBS: true, supportsBrowserSource: true, supportsMultiScreen: true,
    supportsThemes: true, supportsTikTokLiveStudio: true,
    minimumVersion: '1.0.0', maximumVersion: null, platform: 'all', configVersion: 1,
  },
  renderer: GiftComboComponent, settingsSchema: giftComboSchema,
  defaultConfig: giftComboDefaults as unknown as GiftComboConfig,
  validateConfig: (c): c is GiftComboConfig => typeof c === 'object' && c !== null && 'comboTimeout' in c,
  sanitizeConfig: (c) => ({ ...giftComboDefaults, ...c }) as GiftComboConfig,
  migrateConfig: (raw) => (raw as GiftComboConfig) ?? giftComboDefaults as GiftComboConfig,
  eventTypes: ['gift'],
});
