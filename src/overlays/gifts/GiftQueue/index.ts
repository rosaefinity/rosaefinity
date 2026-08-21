import { defineOverlay } from '../../defineOverlay';
import { GiftQueueComponent } from './Component';
import { giftQueueSchema, giftQueueDefaults } from './settings';
import type { GiftQueueConfig } from './types';
import { ListOrdered } from 'lucide-react';

export const GiftQueueOverlay = defineOverlay<GiftQueueConfig>({
  metadata: {
    id: 'gift-queue', name: 'Gift Queue', description: 'Sequential gift display queue',
    category: 'gifts', tags: ['gifts', 'queue', 'sequential', 'playback'],
    author: 'RosaeFinity', version: '1.0.0', icon: ListOrdered,
    thumbnail: '', previewImage: '', beta: false, featured: false, hidden: false,
    premium: false, deprecated: false, requiresLicense: false, licenseTier: 'free',
    supportsOBS: true, supportsBrowserSource: true, supportsMultiScreen: true,
    supportsThemes: true, supportsTikTokLiveStudio: true,
    minimumVersion: '1.0.0', maximumVersion: null, platform: 'all', configVersion: 1,
  },
  renderer: GiftQueueComponent, settingsSchema: giftQueueSchema,
  defaultConfig: giftQueueDefaults as unknown as GiftQueueConfig,
  validateConfig: (c): c is GiftQueueConfig => typeof c === 'object' && c !== null && 'maxQueueSize' in c,
  sanitizeConfig: (c) => ({ ...giftQueueDefaults, ...c }) as GiftQueueConfig,
  migrateConfig: (raw) => (raw as GiftQueueConfig) ?? giftQueueDefaults as GiftQueueConfig,
  eventTypes: ['gift'],
});
