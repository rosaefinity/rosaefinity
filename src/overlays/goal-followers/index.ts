// =============================================
// RosaeFinity — Goal Followers Overlay Module
// Fixed: reacts ONLY to follow events.
// =============================================

import { defineOverlay } from '../defineOverlay';
import React from 'react';
import { GoalProgressRenderer } from '../goal-progress/GoalProgressRenderer';
import { UserPlus } from 'lucide-react';
import type { GoalFollowersConfig } from './types';
import { defaultGoalFollowersConfig } from './types';

const goalFollowersSettingsSchema = [
  {
    title: 'Goal',
    fields: [
      { key: 'title', label: 'Title', type: 'text' as const, placeholder: 'e.g. Road to 1K Followers' },
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

function validate(config: unknown): config is GoalFollowersConfig {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as Record<string, unknown>;
  return typeof c.target === 'number' && typeof c.title === 'string';
}

function sanitize(raw: Record<string, unknown>): GoalFollowersConfig {
  let reachedBehavior = (raw.reachedBehavior as string) || defaultGoalFollowersConfig.reachedBehavior;
  if (reachedBehavior === 'none' || reachedBehavior === 'reset') reachedBehavior = 'keep';

  const toBool = (v: unknown, fallback: boolean): boolean => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v === 'true' || v === '1';
    return fallback;
  };

  return {
    target: typeof raw.target === 'number' ? raw.target : defaultGoalFollowersConfig.target,
    title: typeof raw.title === 'string' ? raw.title : defaultGoalFollowersConfig.title,
    current: typeof raw.current === 'number' ? raw.current : defaultGoalFollowersConfig.current,
    reached: toBool(raw.reached, defaultGoalFollowersConfig.reached),
    lastCompletedTarget: typeof raw.lastCompletedTarget === 'number' ? raw.lastCompletedTarget : defaultGoalFollowersConfig.lastCompletedTarget,
    reachedBehavior: reachedBehavior as GoalFollowersConfig['reachedBehavior'],
    actionId: (raw.actionId as string) || null,
    barColor: typeof raw.barColor === 'string' ? raw.barColor : defaultGoalFollowersConfig.barColor,
    gradientColor: typeof raw.gradientColor === 'string' ? raw.gradientColor : defaultGoalFollowersConfig.gradientColor,
    backgroundColor: typeof raw.backgroundColor === 'string' ? raw.backgroundColor : defaultGoalFollowersConfig.backgroundColor,
    textColor: typeof raw.textColor === 'string' ? raw.textColor : defaultGoalFollowersConfig.textColor,
    showPercentage: toBool(raw.showPercentage, defaultGoalFollowersConfig.showPercentage),
    showNumbers: toBool(raw.showNumbers, defaultGoalFollowersConfig.showNumbers),
  };
}

function migrate(raw: unknown): GoalFollowersConfig {
  return sanitize(raw as Record<string, unknown>);
}

export const goalFollowersOverlay = defineOverlay<GoalFollowersConfig>({
  id: 'goal-followers',
  name: 'Goal Followers',
  description: 'Track followers toward a goal with progress bar',
  category: 'goals',
  icon: UserPlus,
  tags: ['goal', 'followers', 'progress', 'bar'],
  supportsBrowserSource: true,
  supportsPreview: true,
  version: 1,
  configVersion: 1,
  renderer: GoalProgressRenderer as any,
  settingsSchema: goalFollowersSettingsSchema as any,
  defaultConfig: defaultGoalFollowersConfig,
  validate,
  sanitize,
  migrate,
});
