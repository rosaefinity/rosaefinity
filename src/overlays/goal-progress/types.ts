// =============================================
// RosaeFinity — Goal Progress Overlay Types
// =============================================

export type GoalType = 'likes' | 'followers' | 'gifts';

export type GoalReachedBehavior = 'keep' | 'increase' | 'double' | 'hide';

export interface GoalProgressConfig {
  goalType: GoalType;
  /** Formal link to the Goal Store Goal that tracks this overlay's progress. */
  goalId?: string;
  target: number;
  title: string;
  reachedBehavior: GoalReachedBehavior;
  actionId: string | null;
  barColor: string;
  gradientColor: string;
  backgroundColor: string;
  textColor: string;
  showPercentage: boolean;
  showNumbers: boolean;
}

export const defaultGoalProgressConfig: GoalProgressConfig = {
  goalType: 'likes',
  target: 7000,
  title: 'Goal',
  reachedBehavior: 'increase',
  actionId: null,
  barColor: '#8b5cf6',
  gradientColor: '#c084fc',
  backgroundColor: 'transparent',
  textColor: '#ffffff',
  showPercentage: true,
  showNumbers: true,
};
