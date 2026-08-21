import type { SettingsField } from '../../types';

export const pinnedCommentSchema: SettingsField[] = [
  { key: 'pinMode', label: 'Pin Mode', type: 'select', section: 'Mode', options: [
    { value: 'moderator', label: 'Moderator Pins' }, { value: 'latest', label: 'Latest Comment' },
    { value: 'keyword', label: 'Keyword Match' }, { value: 'manual', label: 'Manual' },
  ]},
  { key: 'keyword', label: 'Keyword', type: 'text', section: 'Mode', dependsOn: { key: 'pinMode', value: 'keyword' }, description: 'Pin comments containing this keyword' },
  { key: 'timeout', label: 'Pin Duration (seconds)', type: 'duration', section: 'Timing', min: 3, max: 120 },
  { key: 'maxAge', label: 'Max Comment Age (seconds)', type: 'duration', section: 'Timing', min: 5, max: 60 },
  { key: 'showAvatar', label: 'Show Avatar', type: 'switch', section: 'Display' },
  { key: 'avatarSize', label: 'Avatar Size', type: 'slider', section: 'Display', min: 20, max: 48, dependsOn: { key: 'showAvatar', value: true } },
  { key: 'showBadges', label: 'Show Badges', type: 'switch', section: 'Display' },
  { key: 'showTimestamp', label: 'Show Timestamp', type: 'switch', section: 'Display' },
  { key: 'highlightBorder', label: 'Highlight Border', type: 'switch', section: 'Style' },
  { key: 'borderColor', label: 'Border Color', type: 'color', section: 'Style', dependsOn: { key: 'highlightBorder', value: true } },
  { key: 'borderWidth', label: 'Border Width', type: 'slider', section: 'Style', min: 1, max: 5, dependsOn: { key: 'highlightBorder', value: true } },
  { key: 'entryAnimation', label: 'Entry Animation', type: 'animation', section: 'Animation' },
  { key: 'exitAnimation', label: 'Exit Animation', type: 'animation', section: 'Animation' },
  { key: 'usernameColor', label: 'Username Color', type: 'color', section: 'Colors' },
  { key: 'colors.primary', label: 'Primary Color', type: 'color', section: 'Theme' },
  { key: 'colors.background', label: 'Background', type: 'color', section: 'Theme' },
  { key: 'colors.text', label: 'Text Color', type: 'color', section: 'Theme' },
  { key: 'fontFamily', label: 'Font', type: 'font', section: 'Theme' },
  { key: 'fontSize', label: 'Font Size', type: 'slider', section: 'Theme', min: 12, max: 24 },
  { key: 'border.radius', label: 'Border Radius', type: 'slider', section: 'Theme', min: 0, max: 24 },
  { key: 'opacity', label: 'Opacity', type: 'slider', section: 'Theme', min: 0, max: 1, step: 0.05 },
];

export const pinnedCommentDefaults = {
  pinMode: 'latest' as const, keyword: '', timeout: 15, maxAge: 30,
  showAvatar: true, avatarSize: 32, showBadges: true, showTimestamp: false,
  highlightBorder: true, borderColor: '#fbbf24', borderWidth: 2,
  entryAnimation: 'entry-slide-down', exitAnimation: 'exit-fade',
  usernameColor: '#a855f7',
  colors: { primary: '#fbbf24', secondary: '#4e7bff', background: 'rgba(0,0,0,0.6)', text: '#ffffff', accent: '#f0a020' },
  fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 14, fontWeight: 600,
  border: { width: 0, color: 'transparent', radius: 12 },
  shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', blur: 8, offsetX: 0, offsetY: 2 },
  opacity: 1,
};
