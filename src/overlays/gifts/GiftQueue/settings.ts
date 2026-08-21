import type { SettingsField } from '../../types';

export const giftQueueSchema: SettingsField[] = [
  { key: 'maxQueueSize', label: 'Max Queue Size', type: 'slider', section: 'Queue', min: 1, max: 20 },
  { key: 'playDuration', label: 'Display Duration (seconds)', type: 'duration', section: 'Queue', min: 1, max: 15 },
  { key: 'autoPlay', label: 'Auto Play', type: 'switch', section: 'Queue' },
  { key: 'priorityMode', label: 'Priority Mode', type: 'select', section: 'Queue', options: [
    { value: 'fifo', label: 'First In First Out' }, { value: 'highest-value', label: 'Highest Value First' },
  ]},
  { key: 'showAvatar', label: 'Show Avatar', type: 'switch', section: 'Display' },
  { key: 'showUsername', label: 'Show Username', type: 'switch', section: 'Display' },
  { key: 'showGiftName', label: 'Show Gift Name', type: 'switch', section: 'Display' },
  { key: 'showGiftImage', label: 'Show Gift Image', type: 'switch', section: 'Display' },
  { key: 'showCount', label: 'Show Count', type: 'switch', section: 'Display' },
  { key: 'showDiamonds', label: 'Show Diamonds', type: 'switch', section: 'Display' },
  { key: 'colors.primary', label: 'Primary Color', type: 'color', section: 'Theme' },
  { key: 'colors.background', label: 'Background', type: 'color', section: 'Theme' },
  { key: 'colors.text', label: 'Text Color', type: 'color', section: 'Theme' },
  { key: 'fontFamily', label: 'Font', type: 'font', section: 'Theme' },
  { key: 'fontSize', label: 'Font Size', type: 'slider', section: 'Theme', min: 10, max: 32 },
];

export const giftQueueDefaults = {
  maxQueueSize: 10, playDuration: 5, showAvatar: true, showUsername: true, showGiftName: true,
  showGiftImage: true, showCount: true, showDiamonds: true, autoPlay: true, priorityMode: 'fifo' as const,
  colors: { primary: '#e0306a', secondary: '#4e7bff', background: 'rgba(0,0,0,0.7)', text: '#ffffff', accent: '#f0a020' },
  fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 16, fontWeight: 600,
  border: { width: 0, color: 'transparent', radius: 8 },
  shadow: { enabled: false, color: 'rgba(0,0,0,0.3)', blur: 8, offsetX: 0, offsetY: 2 },
  opacity: 1,
};
