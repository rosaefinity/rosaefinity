// =============================================
// RosaeFinity — Goal Followers Overlay Types
// =============================================

import type { GoalInstanceConfig, GoalReachedBehavior } from '../shared/goal-instance-types';

export type { GoalReachedBehavior };

export interface GoalFollowersConfig extends GoalInstanceConfig {
  // eventType is fixed — no goalType field needed
}

export const defaultGoalFollowersConfig: GoalFollowersConfig = {
  goalType: 'followers',
  title: 'Followers Goal',
  target: 1000,
  current: 0,
  reached: false,
  lastCompletedTarget: 0,
  reachedBehavior: 'increase',
  actionId: null,
  barColor: '#3b82f6',
  gradientColor: '#06b6d4',
  backgroundColor: 'transparent',
  textColor: '#ffffff',
  showPercentage: true,
  showNumbers: true,
};
