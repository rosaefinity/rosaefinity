import type { SettingsField } from '../../types';

export const giftComboSchema: SettingsField[] = [
  { key: 'showUsername', label: 'Show Username', type: 'switch', section: 'Display' },
  { key: 'showGiftName', label: 'Show Gift Name', type: 'switch', section: 'Display' },
  { key: 'showCount', label: 'Show Count', type: 'switch', section: 'Display' },
  { key: 'showTimer', label: 'Show Timer', type: 'switch', section: 'Display' },
  { key: 'comboTimeout', label: 'Combo Timeout (seconds)', type: 'duration', section: 'Behavior', min: 2, max: 30 },
  { key: 'comboAnimation', label: 'Combo Animation', type: 'animation', section: 'Animation' },
  { key: 'countAnimation', label: 'Count Animation', type: 'animation', section: 'Animation' },
  { key: 'colors.primary', label: 'Primary Color', type: 'color', section: 'Theme' },
  { key: 'colors.background', label: 'Background', type: 'color', section: 'Theme' },
  { key: 'colors.text', label: 'Text Color', type: 'color', section: 'Theme' },
  { key: 'fontFamily', label: 'Font', type: 'font', section: 'Theme' },
  { key: 'fontSize', label: 'Font Size', type: 'slider', section: 'Theme', min: 12, max: 48 },
  { key: 'border.radius', label: 'Border Radius', type: 'slider', section: 'Theme', min: 0, max: 24 },
];

export const giftComboDefaults = {
  showUsername: true, showGiftName: true, showCount: true, showTimer: true,
  comboTimeout: 10, comboAnimation: 'entry-pop', countAnimation: 'event-combo-pulse',
  colors: { primary: '#e0306a', secondary: '#4e7bff', background: 'rgba(0,0,0,0.7)', text: '#ffffff', accent: '#f0a020' },
  fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 24, fontWeight: 800,
  border: { width: 0, color: 'transparent', radius: 12 },
  shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', blur: 12, offsetX: 0, offsetY: 2 },
  opacity: 1,
};
