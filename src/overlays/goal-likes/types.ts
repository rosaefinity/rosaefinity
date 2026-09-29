// =============================================
// RosaeFinity — Goal Likes Overlay Types
// =============================================

import type { GoalInstanceConfig, GoalReachedBehavior } from '../shared/goal-instance-types';

export type { GoalReachedBehavior };

export interface GoalLikesConfig extends GoalInstanceConfig {
  // eventType is fixed — no goalType field needed
}

export const defaultGoalLikesConfig: GoalLikesConfig = {
  title: 'Likes Goal',
  target: 10000,
  current: 0,
  reached: false,
  lastCompletedTarget: 0,
  reachedBehavior: 'increase',
  actionId: null,
  barColor: '#ef4444',
  gradientColor: '#f97316',
  backgroundColor: 'transparent',
  textColor: '#ffffff',
  showPercentage: true,
  showNumbers: true,
};
