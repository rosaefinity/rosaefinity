// =============================================
// RosaeFinity â€” Overlay Type Registry
// All 17 overlay type definitions.
// =============================================

import type { OverlayType, OverlayTypeDefinition, AnimationConfig } from './types.js';

const DEFAULT_ANIMATION: AnimationConfig = {
  enter: { type: 'fade', from: { opacity: 0 }, to: { opacity: 1 }, duration: 300, delay: 0 },
  exit: { type: 'fade', from: { opacity: 1 }, to: { opacity: 0 }, duration: 300, delay: 0 },
  duration: 5000,
  easing: 'ease-out',
};

const SLIDE_ANIMATION: AnimationConfig = {
  enter: { type: 'slide', from: { y: -100, opacity: 0 }, to: { y: 0, opacity: 1 }, duration: 400, delay: 0 },
  exit: { type: 'slide', from: { y: 0, opacity: 1 }, to: { y: 100, opacity: 0 }, duration: 300, delay: 0 },
  duration: 5000,
  easing: 'ease-out',
};

const BOUNCE_ANIMATION: AnimationConfig = {
  enter: { type: 'bounce', from: { scale: 0 }, to: { scale: 1 }, duration: 500, delay: 0 },
  exit: { type: 'fade', from: { opacity: 1 }, to: { opacity: 0 }, duration: 300, delay: 0 },
  duration: 6000,
  easing: 'ease-out',
};

const OVERLAY_TYPES: OverlayTypeDefinition[] = [
  // â”€â”€ Alerts â”€â”€
  { type: 'gift-alert', label: 'Gift Alert', category: 'Alerts', icon: 'ðŸŽ', description: 'Animated gift notification', defaultConfig: { message: 'Thanks {{username}} for {{giftName}}!', showImage: true, backgroundColor: '#7C3AED' }, defaultAnimation: BOUNCE_ANIMATION, defaultSize: { width: 400, height: 200 }, maxDuration: 8000, isAlert: true, isGoal: false, isWidget: false },
  { type: 'follow-alert', label: 'Follow Alert', category: 'Alerts', icon: 'ðŸ‘¤', description: 'New follower notification', defaultConfig: { message: 'Welcome {{username}}!', showAvatar: true, backgroundColor: '#EC4899' }, defaultAnimation: SLIDE_ANIMATION, defaultSize: { width: 400, height: 150 }, maxDuration: 5000, isAlert: true, isGoal: false, isWidget: false },
  { type: 'share-alert', label: 'Share Alert', category: 'Alerts', icon: 'ðŸ“¤', description: 'Share notification', defaultConfig: { message: '{{username}} shared the stream!', backgroundColor: '#06B6D4' }, defaultAnimation: SLIDE_ANIMATION, defaultSize: { width: 400, height: 120 }, maxDuration: 4000, isAlert: true, isGoal: false, isWidget: false },
  { type: 'like-alert', label: 'Like Alert', category: 'Alerts', icon: 'â¤ï¸', description: 'Like burst notification', defaultConfig: { message: '{{username}} sent {{likeCount}} likes!', backgroundColor: '#EF4444' }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 350, height: 100 }, maxDuration: 3000, isAlert: true, isGoal: false, isWidget: false },
  { type: 'comment-popup', label: 'Comment Popup', category: 'Alerts', icon: 'ðŸ’¬', description: 'Floating comment display', defaultConfig: { message: '{{username}}: {{comment}}', showAvatar: true, maxComments: 5 }, defaultAnimation: SLIDE_ANIMATION, defaultSize: { width: 350, height: 80 }, maxDuration: 5000, isAlert: true, isGoal: false, isWidget: false },

  // â”€â”€ Goals â”€â”€
  { type: 'viewer-goal', label: 'Viewer Goal', category: 'Goals', icon: 'ðŸ‘¥', description: 'Viewer count progress bar', defaultConfig: { goal: 100, current: 0, label: 'Viewer Goal', color: '#7C3AED', showPercentage: true }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 400, height: 80 }, maxDuration: 0, isAlert: false, isGoal: true, isWidget: false },
  { type: 'follower-goal', label: 'Follower Goal', category: 'Goals', icon: 'ðŸ“ˆ', description: 'Follower count progress bar', defaultConfig: { goal: 1000, current: 0, label: 'Follower Goal', color: '#EC4899', showPercentage: true }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 400, height: 80 }, maxDuration: 0, isAlert: false, isGoal: true, isWidget: false },
  { type: 'coin-goal', label: 'Coin Goal', category: 'Goals', icon: 'ðŸª™', description: 'Coin/diamond progress bar', defaultConfig: { goal: 10000, current: 0, label: 'Coin Goal', color: '#F59E0B', showPercentage: true }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 400, height: 80 }, maxDuration: 0, isAlert: false, isGoal: true, isWidget: false },

  // â”€â”€ Widgets â”€â”€
  { type: 'chat-feed', label: 'Chat Feed', category: 'Widgets', icon: 'ðŸ’¬', description: 'Live chat message feed', defaultConfig: { maxMessages: 10, showTimestamp: true, showAvatar: true, fadeOld: true }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 400, height: 500 }, maxDuration: 0, isAlert: false, isGoal: false, isWidget: true },
  { type: 'top-gifters', label: 'Top Gifters', category: 'Widgets', icon: 'ðŸ†', description: 'Top gifters leaderboard', defaultConfig: { maxEntries: 10, showCoins: true, timeWindow: 'stream' }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 350, height: 400 }, maxDuration: 0, isAlert: false, isGoal: false, isWidget: true },
  { type: 'countdown', label: 'Countdown', category: 'Widgets', icon: 'â±', description: 'Countdown timer', defaultConfig: { targetTime: 0, label: 'Stream starts in', format: 'hh:mm:ss' }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 300, height: 100 }, maxDuration: 0, isAlert: false, isGoal: false, isWidget: true },
  { type: 'poll', label: 'Poll', category: 'Widgets', icon: 'ðŸ“Š', description: 'Interactive poll widget', defaultConfig: { question: '', options: [], votes: {}, duration: 60000 }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 400, height: 300 }, maxDuration: 0, isAlert: false, isGoal: false, isWidget: true },
  { type: 'lucky-wheel', label: 'Lucky Wheel', category: 'Widgets', icon: 'ðŸŽ°', description: 'Spinning wheel of fortune', defaultConfig: { segments: [], spinDuration: 3000 }, defaultAnimation: { ...DEFAULT_ANIMATION, duration: 5000 }, defaultSize: { width: 400, height: 400 }, maxDuration: 8000, isAlert: false, isGoal: false, isWidget: true },

  // â”€â”€ Media â”€â”€
  { type: 'media-overlay', label: 'Media Overlay', category: 'Media', icon: 'ðŸŽ¬', description: 'Generic media overlay', defaultConfig: { mediaType: 'image', mediaId: '', fit: 'contain' }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 640, height: 360 }, maxDuration: 0, isAlert: false, isGoal: false, isWidget: true },
  { type: 'image-overlay', label: 'Image Overlay', category: 'Media', icon: 'ðŸ–¼', description: 'Static image overlay', defaultConfig: { imageUrl: '', fit: 'contain', borderRadius: 0 }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 400, height: 300 }, maxDuration: 0, isAlert: false, isGoal: false, isWidget: true },
  { type: 'video-overlay', label: 'Video Overlay', category: 'Media', icon: 'ðŸŽ¥', description: 'Video overlay with playback', defaultConfig: { videoUrl: '', autoplay: true, loop: false, volume: 100 }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 640, height: 360 }, maxDuration: 0, isAlert: false, isGoal: false, isWidget: true },
  { type: 'browser-source', label: 'Browser Source', category: 'Media', icon: 'ðŸŒ', description: 'Embedded web page overlay', defaultConfig: { url: '', width: 800, height: 600, fps: 30, transparent: false, css: '', javascript: '' }, defaultAnimation: DEFAULT_ANIMATION, defaultSize: { width: 800, height: 600 }, maxDuration: 0, isAlert: false, isGoal: false, isWidget: true },
];

const typeMap = new Map<string, OverlayTypeDefinition>(OVERLAY_TYPES.map(o => [o.type, o]));
const categoryMap = new Map<string, OverlayTypeDefinition[]>();
for (const o of OVERLAY_TYPES) {
  const arr = categoryMap.get(o.category) || [];
  arr.push(o);
  categoryMap.set(o.category, arr);
}

export function getAllOverlayTypes(): readonly OverlayTypeDefinition[] { return OVERLAY_TYPES; }
export function getOverlayType(type: OverlayType): OverlayTypeDefinition | undefined { return typeMap.get(type); }
export function getOverlayTypesByCategory(): Map<string, readonly OverlayTypeDefinition[]> { return categoryMap as any; }
