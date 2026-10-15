// =============================================
// RosaeFinity — Goal Progress Overlay Module
// Registers as an overlay in the Overlay Gallery.
// =============================================

import { defineOverlay } from '../defineOverlay';
import React from 'react';
import { GoalProgressRenderer } from './GoalProgressRenderer';
import { Target } from 'lucide-react';
import type { GoalProgressConfig } from './types';
import { defaultGoalProgressConfig } from './types';

const goalProgressSettingsSchema = [
  {
    title: 'Goal',
    fields: [
      { key: 'title', label: 'Title', type: 'text' as const, placeholder: 'e.g. Road to 10K Likes' },
      { key: 'target', label: 'Target Amount', type: 'number' as const, min: 1, max: 999999999 },
      { key: 'reachedBehavior', label: 'When Reached', type: 'select' as const, options: [
        { value: 'keep', label: 'Keep Goal' },
        { value: 'increase', label: 'Increase Goal' },
        { value: 'double', label: 'Double Goal' },
        { value: 'hide', label: 'Hide' },
      ]},
      { key: 'actionId', label: 'Action on Reaching', type: 'select' as const, options: [] },
    ],
  },
  {
    title: 'Appearance',
    fields: [
      { key: 'textColor', label: 'Text Color', type: 'color' as const },
      { key: 'barColor', label: 'Progress Color', type: 'color' as const },
      { key: 'gradientColor', label: 'Gradient Color', type: 'color' as const },
      { key: 'backgroundColor', label: 'Background', type: 'text' as const },
      { key: 'showPercentage', label: 'Show Percentage', type: 'toggle' as const },
      { key: 'showNumbers', label: 'Show Numbers', type: 'toggle' as const },
    ],
  },
] as const;

function validateGoalProgressConfig(config: unknown): config is GoalProgressConfig {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as Record<string, unknown>;
  return typeof c.target === 'number' && typeof c.title === 'string';
}

/** Normalize old configs: string booleans → real booleans, missing fields → defaults, old reachedBehavior values */
function sanitizeGoalProgressConfig(raw: Record<string, unknown>): GoalProgressConfig {
  // Normalize reachedBehavior from old values
  let reachedBehavior = (raw.reachedBehavior as string) || defaultGoalProgressConfig.reachedBehavior;
  if (reachedBehavior === 'none' || reachedBehavior === 'reset') reachedBehavior = 'keep';

  // Normalize string booleans to real booleans
  const toBool = (v: unknown, fallback: boolean): boolean => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v === 'true' || v === '1';
    return fallback;
  };

  return {
    goalType: 'likes',
    target: typeof raw.target === 'number' ? raw.target : defaultGoalProgressConfig.target,
    // Increase-mode step base: preserve explicit initialTarget; otherwise
    // seed from the configured target (never stripped — old configs fall
    // back to target, which is correct for a fresh goal).
    initialTarget: typeof raw.initialTarget === 'number' && raw.initialTarget > 0
      ? raw.initialTarget
      : (typeof raw.target === 'number' && raw.target > 0 ? raw.target : defaultGoalProgressConfig.initialTarget),
    title: typeof raw.title === 'string' ? raw.title : defaultGoalProgressConfig.title,
    reachedBehavior: reachedBehavior as GoalProgressConfig['reachedBehavior'],
    actionId: (raw.actionId as string) || null,
    barColor: typeof raw.barColor === 'string' ? raw.barColor : defaultGoalProgressConfig.barColor,
    gradientColor: typeof raw.gradientColor === 'string' ? raw.gradientColor : defaultGoalProgressConfig.gradientColor,
    backgroundColor: typeof raw.backgroundColor === 'string' ? raw.backgroundColor : defaultGoalProgressConfig.backgroundColor,
    textColor: typeof raw.textColor === 'string' ? raw.textColor : defaultGoalProgressConfig.textColor,
    showPercentage: toBool(raw.showPercentage, defaultGoalProgressConfig.showPercentage),
    showNumbers: toBool(raw.showNumbers, defaultGoalProgressConfig.showNumbers),
  };
}

function migrateGoalProgressConfig(raw: unknown, version?: number): GoalProgressConfig {
  return sanitizeGoalProgressConfig(raw as Record<string, unknown>);
}

export const goalProgressOverlay = defineOverlay<GoalProgressConfig>({
  id: 'goal-progress',
  name: 'Goal Likes',
  description: 'Track likes toward a goal with progress bar',
  category: 'goals',
  icon: Target,
  tags: ['goal', 'likes', 'progress', 'bar'],
  supportsBrowserSource: true,
  supportsPreview: true,
  version: 1,
  configVersion: 1,
  renderer: GoalProgressRenderer as any,
  settingsSchema: goalProgressSettingsSchema as any,
  defaultConfig: defaultGoalProgressConfig,
  validate: validateGoalProgressConfig,
  sanitize: sanitizeGoalProgressConfig,
  migrate: migrateGoalProgressConfig,
});
