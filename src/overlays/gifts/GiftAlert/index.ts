import { defineOverlay } from '../../defineOverlay';
import { GiftAlertComponent } from './Component';
import { giftAlertSchema, giftAlertDefaults } from './settings';
import type { GiftAlertConfig } from './types';
import { Bell } from 'lucide-react';

export const GiftAlertOverlay = defineOverlay<GiftAlertConfig>({
  metadata: {
    id: 'gift-alert', name: 'Gift Alert', description: 'Large animated gift alert banner',
    category: 'gifts', tags: ['gifts', 'alert', 'banner', 'animation'],
    author: 'RosaeFinity', version: '1.0.0', icon: Bell,
    thumbnail: '', previewImage: '', beta: false, featured: true, hidden: false,
    premium: false, deprecated: false, requiresLicense: false, licenseTier: 'free',
    supportsOBS: true, supportsBrowserSource: true, supportsMultiScreen: true,
    supportsThemes: true, supportsTikTokLiveStudio: true,
    minimumVersion: '1.0.0', maximumVersion: null, platform: 'all', configVersion: 1,
  },
  renderer: GiftAlertComponent, settingsSchema: giftAlertSchema,
  defaultConfig: giftAlertDefaults as unknown as GiftAlertConfig,
  validateConfig: (c): c is GiftAlertConfig => typeof c === 'object' && c !== null && 'alertStyle' in c,
  sanitizeConfig: (c) => ({ ...giftAlertDefaults, ...c }) as GiftAlertConfig,
  migrateConfig: (raw) => (raw as GiftAlertConfig) ?? giftAlertDefaults as GiftAlertConfig,
  eventTypes: ['gift'],
});
