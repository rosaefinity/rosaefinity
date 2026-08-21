import { defineOverlay } from '../../defineOverlay';
import { EmojiRainComponent } from './Component';
import { emojiRainSchema, emojiRainDefaults } from './settings';
import type { EmojiRainConfig } from './types';
import { SmilePlus } from 'lucide-react';

export const EmojiRainOverlay = defineOverlay<EmojiRainConfig>({
  metadata: {
    id: 'emoji-rain', name: 'Emoji Rain', description: 'Emoji particle rain from chat messages',
    category: 'chat', tags: ['chat', 'emoji', 'particles', 'rain', 'effects', 'live', 'tiktok'],
    author: 'RosaeFinity', version: '1.0.0', icon: SmilePlus,
    thumbnail: '', previewImage: '', beta: false, featured: false, hidden: false,
    premium: false, deprecated: false, requiresLicense: false, licenseTier: 'free',
    supportsOBS: true, supportsBrowserSource: true, supportsMultiScreen: true,
    supportsThemes: true, supportsTikTokLiveStudio: true,
    minimumVersion: '1.0.0', maximumVersion: null, platform: 'all', configVersion: 1,
  },
  renderer: EmojiRainComponent, settingsSchema: emojiRainSchema,
  defaultConfig: emojiRainDefaults as unknown as EmojiRainConfig,
  validateConfig: (c): c is EmojiRainConfig => typeof c === 'object' && c !== null && 'gravity' in c,
  sanitizeConfig: (c) => ({ ...emojiRainDefaults, ...c }) as EmojiRainConfig,
  migrateConfig: (raw) => (raw as EmojiRainConfig) ?? emojiRainDefaults as EmojiRainConfig,
  eventTypes: ['comment'],
});
