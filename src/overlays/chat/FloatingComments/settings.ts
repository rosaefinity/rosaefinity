import type { SettingsField } from '../../types';

export const floatingCommentsSchema: SettingsField[] = [
  { key: 'direction', label: 'Direction', type: 'select', section: 'Movement', options: [
    { value: 'left-to-right', label: 'Left to Right' }, { value: 'right-to-left', label: 'Right to Left' },
  ]},
  { key: 'speed', label: 'Speed', type: 'slider', section: 'Movement', min: 1, max: 20 },
  { key: 'messageOpacity', label: 'Opacity', type: 'slider', section: 'Appearance', min: 0.1, max: 1, step: 0.05 },
  { key: 'messageSize', label: 'Font Size', type: 'slider', section: 'Appearance', min: 12, max: 36 },
  { key: 'randomRotation', label: 'Random Rotation', type: 'switch', section: 'Appearance' },
  { key: 'maxRotation', label: 'Max Rotation (degrees)', type: 'slider', section: 'Appearance', min: 0, max: 30, dependsOn: { key: 'randomRotation', value: true } },
  { key: 'bezierEnabled', label: 'Bezier Movement', type: 'switch', section: 'Movement' },
  { key: 'bezierIntensity', label: 'Bezier Intensity', type: 'slider', section: 'Movement', min: 0, max: 50, dependsOn: { key: 'bezierEnabled', value: true } },
  { key: 'fadeEnabled', label: 'Fade at Edges', type: 'switch', section: 'Appearance' },
  { key: 'lifetime', label: 'Lifetime (seconds)', type: 'duration', section: 'Behavior', min: 2, max: 15 },
  { key: 'maxVisible', label: 'Max Visible', type: 'slider', section: 'Behavior', min: 1, max: 30 },
  { key: 'showAvatar', label: 'Show Avatar', type: 'switch', section: 'Display' },
  { key: 'avatarSize', label: 'Avatar Size', type: 'slider', section: 'Display', min: 16, max: 40, dependsOn: { key: 'showAvatar', value: true } },
  { key: 'usernameColor', label: 'Username Color', type: 'color', section: 'Colors' },
  { key: 'strokeEnabled', label: 'Text Stroke', type: 'switch', section: 'Text Effects' },
  { key: 'strokeColor', label: 'Stroke Color', type: 'color', section: 'Text Effects', dependsOn: { key: 'strokeEnabled', value: true } },
  { key: 'strokeWidth', label: 'Stroke Width', type: 'slider', section: 'Text Effects', min: 1, max: 4, dependsOn: { key: 'strokeEnabled', value: true } },
  { key: 'emojiScale', label: 'Emoji Scale', type: 'slider', section: 'Emoji', min: 0.5, max: 3, step: 0.1 },
  { key: 'colors.text', label: 'Text Color', type: 'color', section: 'Theme' },
  { key: 'fontFamily', label: 'Font', type: 'font', section: 'Theme' },
  { key: 'opacity', label: 'Opacity', type: 'slider', section: 'Theme', min: 0, max: 1, step: 0.05 },
];

export const floatingCommentsDefaults = {
  direction: 'left-to-right' as const, speed: 5, messageOpacity: 0.9, messageSize: 16,
  randomRotation: false, maxRotation: 10, bezierEnabled: false, bezierIntensity: 20,
  fadeEnabled: true, lifetime: 8, maxVisible: 15, showAvatar: false, avatarSize: 24,
  usernameColor: '#a855f7', strokeEnabled: true, strokeColor: '#000000', strokeWidth: 2,
  emojiScale: 1.2,
  colors: { primary: '#a855f7', secondary: '#4e7bff', background: 'transparent', text: '#ffffff', accent: '#f0a020' },
  fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 14, fontWeight: 600,
  border: { width: 0, color: 'transparent', radius: 0 },
  shadow: { enabled: false, color: 'rgba(0,0,0,0.3)', blur: 0, offsetX: 0, offsetY: 0 },
  opacity: 1,
};
