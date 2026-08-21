import { defineOverlay } from '../../defineOverlay';
import { PinnedCommentComponent } from './Component';
import { pinnedCommentSchema, pinnedCommentDefaults } from './settings';
import type { PinnedCommentConfig } from './types';
import { Pin } from 'lucide-react';

export const PinnedCommentOverlay = defineOverlay<PinnedCommentConfig>({
  metadata: {
    id: 'pinned-comment', name: 'Pinned Comment', description: 'Display pinned chat comments',
    category: 'chat', tags: ['chat', 'comment', 'pinned', 'highlight', 'live', 'tiktok'],
    author: 'RosaeFinity', version: '1.0.0', icon: Pin,
    thumbnail: '', previewImage: '', beta: false, featured: false, hidden: false,
    premium: false, deprecated: false, requiresLicense: false, licenseTier: 'free',
    supportsOBS: true, supportsBrowserSource: true, supportsMultiScreen: true,
    supportsThemes: true, supportsTikTokLiveStudio: true,
    minimumVersion: '1.0.0', maximumVersion: null, platform: 'all', configVersion: 1,
  },
  renderer: PinnedCommentComponent, settingsSchema: pinnedCommentSchema,
  defaultConfig: pinnedCommentDefaults as unknown as PinnedCommentConfig,
  validateConfig: (c): c is PinnedCommentConfig => typeof c === 'object' && c !== null && 'pinMode' in c,
  sanitizeConfig: (c) => ({ ...pinnedCommentDefaults, ...c }) as PinnedCommentConfig,
  migrateConfig: (raw) => (raw as PinnedCommentConfig) ?? pinnedCommentDefaults as PinnedCommentConfig,
  eventTypes: ['comment'],
});
