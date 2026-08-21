import { defineOverlay } from '../../defineOverlay';
import { FloatingCommentsComponent } from './Component';
import { floatingCommentsSchema, floatingCommentsDefaults } from './settings';
import type { FloatingCommentsConfig } from './types';
import { MessageCircle } from 'lucide-react';

export const FloatingCommentsOverlay = defineOverlay<FloatingCommentsConfig>({
  metadata: {
    id: 'floating-comments', name: 'Floating Comments', description: 'Animated floating chat comments',
    category: 'chat', tags: ['chat', 'comment', 'floating', 'animated', 'live', 'tiktok'],
    author: 'RosaeFinity', version: '1.0.0', icon: MessageCircle,
    thumbnail: '', previewImage: '', beta: false, featured: false, hidden: false,
    premium: false, deprecated: false, requiresLicense: false, licenseTier: 'free',
    supportsOBS: true, supportsBrowserSource: true, supportsMultiScreen: true,
    supportsThemes: true, supportsTikTokLiveStudio: true,
    minimumVersion: '1.0.0', maximumVersion: null, platform: 'all', configVersion: 1,
  },
  renderer: FloatingCommentsComponent, settingsSchema: floatingCommentsSchema,
  defaultConfig: floatingCommentsDefaults as unknown as FloatingCommentsConfig,
  validateConfig: (c): c is FloatingCommentsConfig => typeof c === 'object' && c !== null && 'direction' in c,
  sanitizeConfig: (c) => ({ ...floatingCommentsDefaults, ...c }) as FloatingCommentsConfig,
  migrateConfig: (raw) => (raw as FloatingCommentsConfig) ?? floatingCommentsDefaults as FloatingCommentsConfig,
  eventTypes: ['comment'],
});
