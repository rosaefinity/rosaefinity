import { defineOverlay } from '../../defineOverlay';
import { ChatBoxComponent } from './Component';
import { chatBoxSchema, chatBoxDefaults } from './settings';
import type { ChatBoxConfig } from './types';
import { MessageSquare } from 'lucide-react';

export const ChatBoxOverlay = defineOverlay<ChatBoxConfig>({
  metadata: {
    id: 'chat-box', name: 'Chat Box', description: 'Scrolling live chat message overlay',
    category: 'chat', tags: ['chat', 'comment', 'messages', 'live', 'tiktok'],
    author: 'RosaeFinity', version: '1.0.0', icon: MessageSquare,
    thumbnail: '', previewImage: '', beta: false, featured: true, hidden: false,
    premium: false, deprecated: false, requiresLicense: false, licenseTier: 'free',
    supportsOBS: true, supportsBrowserSource: true, supportsMultiScreen: true,
    supportsThemes: true, supportsTikTokLiveStudio: true,
    minimumVersion: '1.0.0', maximumVersion: null, platform: 'all', configVersion: 1,
  },
  renderer: ChatBoxComponent, settingsSchema: chatBoxSchema,
  defaultConfig: chatBoxDefaults as unknown as ChatBoxConfig,
  validateConfig: (c): c is ChatBoxConfig => typeof c === 'object' && c !== null && 'maxMessages' in c,
  sanitizeConfig: (c) => ({ ...chatBoxDefaults, ...c }) as ChatBoxConfig,
  migrateConfig: (raw) => (raw as ChatBoxConfig) ?? chatBoxDefaults as ChatBoxConfig,
  eventTypes: ['comment'],
});
