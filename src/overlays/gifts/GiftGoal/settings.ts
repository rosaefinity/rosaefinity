import type { SettingsField } from '../../types';

export const giftGoalSchema: SettingsField[] = [
  { key: 'target', label: 'Target', type: 'number', section: 'Goal', min: 1 },
  { key: 'current', label: 'Current', type: 'number', section: 'Goal', min: 0 },
  { key: 'showPercentage', label: 'Show Percentage', type: 'switch', section: 'Display' },
  { key: 'showCount', label: 'Show Count', type: 'switch', section: 'Display' },
  { key: 'showTarget', label: 'Show Target', type: 'switch', section: 'Display' },
  { key: 'barHeight', label: 'Bar Height', type: 'slider', section: 'Bar', min: 4, max: 40 },
  { key: 'barStyle', label: 'Bar Style', type: 'select', section: 'Bar', options: [
    { value: 'solid', label: 'Solid' }, { value: 'gradient', label: 'Gradient' }, { value: 'striped', label: 'Striped' },
  ]},
  { key: 'barColor', label: 'Bar Color', type: 'color', section: 'Bar' },
  { key: 'barBackgroundColor', label: 'Background Color', type: 'color', section: 'Bar' },
  { key: 'celebrateAtGoal', label: 'Celebrate at Goal', type: 'switch', section: 'Behavior' },
  { key: 'celebrateAnimation', label: 'Celebrate Animation', type: 'animation', section: 'Behavior', dependsOn: { key: 'celebrateAtGoal', value: true } },
  { key: 'autoReset', label: 'Auto Reset', type: 'switch', section: 'Behavior' },
  { key: 'resetInterval', label: 'Reset Interval', type: 'select', section: 'Behavior', options: [
    { value: 'stream', label: 'Per Stream' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'never', label: 'Never' },
  ], dependsOn: { key: 'autoReset', value: true } },
  { key: 'colors.primary', label: 'Primary Color', type: 'color', section: 'Theme' },
  { key: 'colors.text', label: 'Text Color', type: 'color', section: 'Theme' },
  { key: 'fontFamily', label: 'Font', type: 'font', section: 'Theme' },
  { key: 'fontSize', label: 'Font Size', type: 'slider', section: 'Theme', min: 10, max: 24 },
  { key: 'opacity', label: 'Opacity', type: 'slider', section: 'Theme', min: 0, max: 1, step: 0.05 },
];

export const giftGoalDefaults = {
  target: 100, current: 0, showPercentage: true, showCount: true, showTarget: true,
  barHeight: 20, barStyle: 'gradient' as const, barColor: '#e0306a', barBackgroundColor: 'rgba(255,255,255,0.1)',
  celebrateAtGoal: true, celebrateAnimation: 'event-fireworks', autoReset: false, resetInterval: 'stream' as const,
  colors: { primary: '#e0306a', secondary: '#4e7bff', background: 'transparent', text: '#ffffff', accent: '#f0a020' },
  fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: 14, fontWeight: 600,
  border: { width: 0, color: 'transparent', radius: 8 },
  shadow: { enabled: false, color: 'rgba(0,0,0,0.3)', blur: 8, offsetX: 0, offsetY: 2 },
  opacity: 1,
};
