import { defineOverlay } from '../../defineOverlay';
import { GiftFeedComponent } from './Component';
import { giftFeedSchema, giftFeedDefaults } from './settings';
import type { GiftFeedConfig } from './types';
import { Gift } from 'lucide-react';

export const GiftFeedOverlay = defineOverlay<GiftFeedConfig>({
  metadata: {
    id: 'gift-feed',
    name: 'Gift Feed',
    description: 'Live scrolling list of recent gifts',
    category: 'gifts',
    tags: ['gifts', 'feed', 'list', 'scrolling', 'real-time'],
    author: 'RosaeFinity',
    version: '1.0.0',
    icon: Gift,
    thumbnail: '',
    previewImage: '',
    beta: false,
    featured: true,
    hidden: false,
    premium: false,
    deprecated: false,
    requiresLicense: false,
    licenseTier: 'free',
    supportsOBS: true,
    supportsBrowserSource: true,
    supportsMultiScreen: true,
    supportsThemes: true,
    supportsTikTokLiveStudio: true,
    minimumVersion: '1.0.0',
    maximumVersion: null,
    platform: 'all',
    configVersion: 1,
  },
  renderer: GiftFeedComponent,
  settingsSchema: giftFeedSchema,
  defaultConfig: giftFeedDefaults as unknown as GiftFeedConfig,
  validateConfig: (c): c is GiftFeedConfig => typeof c === 'object' && c !== null && 'maxItems' in c,
  sanitizeConfig: (c) => ({ ...giftFeedDefaults, ...c }) as GiftFeedConfig,
  migrateConfig: (raw) => (raw as GiftFeedConfig) ?? giftFeedDefaults as GiftFeedConfig,
  eventTypes: ['gift'],
});
