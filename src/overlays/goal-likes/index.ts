// =============================================
// RosaeFinity — Goal Likes Overlay Module
// Fixed: reacts ONLY to like events.
// =============================================

import { defineOverlay } from '../defineOverlay';
import React from 'react';
import { GoalProgressRenderer } from '../goal-progress/GoalProgressRenderer';
import { Heart } from 'lucide-react';
import type { GoalLikesConfig } from './types';
import { defaultGoalLikesConfig } from './types';

const goalLikesSettingsSchema = [
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

function validate(config: unknown): config is GoalLikesConfig {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as Record<string, unknown>;
  return typeof c.target === 'number' && typeof c.title === 'string';
}

function sanitize(raw: Record<string, unknown>): GoalLikesConfig {
  let reachedBehavior = (raw.reachedBehavior as string) || defaultGoalLikesConfig.reachedBehavior;
  if (reachedBehavior === 'none' || reachedBehavior === 'reset') reachedBehavior = 'keep';

  const toBool = (v: unknown, fallback: boolean): boolean => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v === 'true' || v === '1';
    return fallback;
  };

  return {
    target: typeof raw.target === 'number' ? raw.target : defaultGoalLikesConfig.target,
    title: typeof raw.title === 'string' ? raw.title : defaultGoalLikesConfig.title,
    current: typeof raw.current === 'number' ? raw.current : defaultGoalLikesConfig.current,
    reached: toBool(raw.reached, defaultGoalLikesConfig.reached),
    lastCompletedTarget: typeof raw.lastCompletedTarget === 'number' ? raw.lastCompletedTarget : defaultGoalLikesConfig.lastCompletedTarget,
    reachedBehavior: reachedBehavior as GoalLikesConfig['reachedBehavior'],
    actionId: (raw.actionId as string) || null,
    // Session/mode state — must survive sanitize or increase-mode step + like baselines break
    initialTarget: typeof raw.initialTarget === 'number' && raw.initialTarget > 0
      ? raw.initialTarget
      : (typeof raw.target === 'number' && raw.target > 0 ? raw.target : defaultGoalLikesConfig.initialTarget),
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
    lastLikeTotal: typeof raw.lastLikeTotal === 'number' ? raw.lastLikeTotal : 0,
    barColor: typeof raw.barColor === 'string' ? raw.barColor : defaultGoalLikesConfig.barColor,
    gradientColor: typeof raw.gradientColor === 'string' ? raw.gradientColor : defaultGoalLikesConfig.gradientColor,
    backgroundColor: typeof raw.backgroundColor === 'string' ? raw.backgroundColor : defaultGoalLikesConfig.backgroundColor,
    textColor: typeof raw.textColor === 'string' ? raw.textColor : defaultGoalLikesConfig.textColor,
    showPercentage: toBool(raw.showPercentage, defaultGoalLikesConfig.showPercentage),
    showNumbers: toBool(raw.showNumbers, defaultGoalLikesConfig.showNumbers),
  };
}

function migrate(raw: unknown): GoalLikesConfig {
  return sanitize(raw as Record<string, unknown>);
}

export const goalLikesOverlay = defineOverlay<GoalLikesConfig>({
  id: 'goal-likes',
  name: 'Goal Likes',
  description: 'Track likes toward a goal with progress bar',
  category: 'goals',
  icon: Heart,
  tags: ['goal', 'likes', 'progress', 'bar'],
  supportsBrowserSource: true,
  supportsPreview: true,
  version: 1,
  configVersion: 1,
  renderer: GoalProgressRenderer as any,
  settingsSchema: goalLikesSettingsSchema as any,
  defaultConfig: defaultGoalLikesConfig,
  validate,
  sanitize,
  migrate,
});
