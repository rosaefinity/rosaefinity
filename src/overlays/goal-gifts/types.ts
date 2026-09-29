// =============================================
// RosaeFinity — Goal Gifts Overlay Types
// =============================================

import type { GoalInstanceConfig, GoalReachedBehavior } from '../shared/goal-instance-types';

export type { GoalReachedBehavior };

export interface GoalGiftsConfig extends GoalInstanceConfig {
  // eventType is fixed — no goalType field needed
}

export const defaultGoalGiftsConfig: GoalGiftsConfig = {
  goalType: 'gifts',
  title: 'Gifts Goal',
  target: 5000,
  current: 0,
  reached: false,
  lastCompletedTarget: 0,
  reachedBehavior: 'increase',
  actionId: null,
  barColor: '#f59e0b',
  gradientColor: '#eab308',
  backgroundColor: 'transparent',
  textColor: '#ffffff',
  showPercentage: true,
  showNumbers: true,
};
