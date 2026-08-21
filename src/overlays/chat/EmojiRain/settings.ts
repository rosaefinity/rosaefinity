import type { SettingsField } from '../../types';

export const emojiRainSchema: SettingsField[] = [
  { key: 'particleCount', label: 'Particles per Comment', type: 'slider', section: 'Particles', min: 1, max: 20 },
  { key: 'gravity', label: 'Gravity', type: 'slider', section: 'Physics', min: 0.1, max: 5, step: 0.1 },
  { key: 'wind', label: 'Wind', type: 'slider', section: 'Physics', min: -5, max: 5, step: 0.1 },
  { key: 'bounce', label: 'Bounce', type: 'slider', section: 'Physics', min: 0, max: 1, step: 0.05 },
  { key: 'randomScale', label: 'Random Scale', type: 'switch', section: 'Appearance' },
  { key: 'minScale', label: 'Min Scale', type: 'slider', section: 'Appearance', min: 0.3, max: 1, step: 0.1, dependsOn: { key: 'randomScale', value: true } },
  { key: 'maxScale', label: 'Max Scale', type: 'slider', section: 'Appearance', min: 1, max: 3, step: 0.1, dependsOn: { key: 'randomScale', value: true } },
  { key: 'randomRotation', label: 'Random Rotation', type: 'switch', section: 'Appearance' },
  { key: 'density', label: 'Density', type: 'slider', section: 'Particles', min: 1, max: 10 },
  { key: 'lifetime', label: 'Lifetime (seconds)', type: 'duration', section: 'Behavior', min: 1, max: 10 },
  { key: 'emojiChars', label: 'Custom Emojis', type: 'text', section: 'Emoji', description: 'Comma-separated emoji chars' },
  { key: 'extractFromMessage', label: 'Extract from Message', type: 'switch', section: 'Emoji' },
  { key: 'fallbackEmoji', label: 'Fallback Emoji', type: 'text', section: 'Emoji' },
  { key: 'spawnArea', label: 'Spawn Area', type: 'select', section: 'Spawn', options: [
    { value: 'top', label: 'Top' }, { value: 'random', label: 'Random' },
  ]},
  { key: 'opacity', label: 'Opacity', type: 'slider', section: 'Theme', min: 0, max: 1, step: 0.05 },
];

export const emojiRainDefaults = {
  particleCount: 5, gravity: 2, wind: 0, bounce: 0.3,
  randomScale: true, minScale: 0.8, maxScale: 1.5, randomRotation: true,
  density: 3, lifetime: 4, emojiChars: ['🎉', '🔥', '❤️', '💜', '⭐', '💎', '🌟'],
  extractFromMessage: true, fallbackEmoji: '🎉', spawnArea: 'top' as const,
  colors: { primary: '#a855f7', secondary: '#4e7bff', background: 'transparent', text: '#ffffff', accent: '#f0a020' },
  fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 14, fontWeight: 600,
  border: { width: 0, color: 'transparent', radius: 0 },
  shadow: { enabled: false, color: 'rgba(0,0,0,0.3)', blur: 0, offsetX: 0, offsetY: 0 },
  opacity: 1,
};
