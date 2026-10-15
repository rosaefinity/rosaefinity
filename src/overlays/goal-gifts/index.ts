// =============================================
// RosaeFinity — Goal Gifts Overlay Module
// Fixed: reacts ONLY to gift events.
// =============================================

import { defineOverlay } from '../defineOverlay';
import React from 'react';
import { GoalProgressRenderer } from '../goal-progress/GoalProgressRenderer';
import { Gift } from 'lucide-react';
import type { GoalGiftsConfig } from './types';
import { defaultGoalGiftsConfig } from './types';

const goalGiftsSettingsSchema = [
  {
    title: 'Goal',
    fields: [
      { key: 'title', label: 'Title', type: 'text' as const, placeholder: 'e.g. Road to 5K Coins' },
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

function validate(config: unknown): config is GoalGiftsConfig {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as Record<string, unknown>;
  return typeof c.target === 'number' && typeof c.title === 'string';
}

function sanitize(raw: Record<string, unknown>): GoalGiftsConfig {
  let reachedBehavior = (raw.reachedBehavior as string) || defaultGoalGiftsConfig.reachedBehavior;
  if (reachedBehavior === 'none' || reachedBehavior === 'reset') reachedBehavior = 'keep';

  const toBool = (v: unknown, fallback: boolean): boolean => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v === 'true' || v === '1';
    return fallback;
  };

  return {
    target: typeof raw.target === 'number' ? raw.target : defaultGoalGiftsConfig.target,
    title: typeof raw.title === 'string' ? raw.title : defaultGoalGiftsConfig.title,
    current: typeof raw.current === 'number' ? raw.current : defaultGoalGiftsConfig.current,
    reached: toBool(raw.reached, defaultGoalGiftsConfig.reached),
    lastCompletedTarget: typeof raw.lastCompletedTarget === 'number' ? raw.lastCompletedTarget : defaultGoalGiftsConfig.lastCompletedTarget,
    reachedBehavior: reachedBehavior as GoalGiftsConfig['reachedBehavior'],
    actionId: (raw.actionId as string) || null,
    // Session/mode state — must survive sanitize or increase-mode step + like baselines break
    initialTarget: typeof raw.initialTarget === 'number' && raw.initialTarget > 0
      ? raw.initialTarget
      : (typeof raw.target === 'number' && raw.target > 0 ? raw.target : defaultGoalGiftsConfig.initialTarget),
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
    lastLikeTotal: typeof raw.lastLikeTotal === 'number' ? raw.lastLikeTotal : 0,
    barColor: typeof raw.barColor === 'string' ? raw.barColor : defaultGoalGiftsConfig.barColor,
    gradientColor: typeof raw.gradientColor === 'string' ? raw.gradientColor : defaultGoalGiftsConfig.gradientColor,
    backgroundColor: typeof raw.backgroundColor === 'string' ? raw.backgroundColor : defaultGoalGiftsConfig.backgroundColor,
    textColor: typeof raw.textColor === 'string' ? raw.textColor : defaultGoalGiftsConfig.textColor,
    showPercentage: toBool(raw.showPercentage, defaultGoalGiftsConfig.showPercentage),
    showNumbers: toBool(raw.showNumbers, defaultGoalGiftsConfig.showNumbers),
  };
}

function migrate(raw: unknown): GoalGiftsConfig {
  return sanitize(raw as Record<string, unknown>);
}

export const goalGiftsOverlay = defineOverlay<GoalGiftsConfig>({
  id: 'goal-gifts',
  name: 'Goal Gifts',
  description: 'Track gift coins toward a goal with progress bar',
  category: 'goals',
  icon: Gift,
  tags: ['goal', 'gifts', 'coins', 'progress', 'bar'],
  supportsBrowserSource: true,
  supportsPreview: true,
  version: 1,
  configVersion: 1,
  renderer: GoalProgressRenderer as any,
  settingsSchema: goalGiftsSettingsSchema as any,
  defaultConfig: defaultGoalGiftsConfig,
  validate,
  sanitize,
  migrate,
});
