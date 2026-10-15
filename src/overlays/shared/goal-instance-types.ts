// =============================================
// RosaeFinity — Shared Goal Instance Types
// Used by goal-likes, goal-followers, goal-gifts modules.
// =============================================

export type GoalReachedBehavior = 'keep' | 'increase' | 'double' | 'hide';

export interface GoalInstanceConfig {
  // Goal state (stored in overlay instance config)
  title: string;
  target: number;
  current: number;
  reached: boolean;
  lastCompletedTarget: number;
  reachedBehavior: GoalReachedBehavior;
  actionId: string | null;
  /** Original configured target — step size for 'increase' mode
   *  (newTarget = oldTarget + initialTarget). */
  initialTarget?: number;
  /** LIVE-session identity (TikTok roomId) this progress belongs to. */
  sessionId?: string | null;
  /** Last observed cumulative like total for session-delta math. */
  lastLikeTotal?: number;

  // Visual
  barColor: string;
  gradientColor: string;
  backgroundColor: string;
  textColor: string;
  showPercentage: boolean;
  showNumbers: boolean;
}

export const defaultGoalInstanceConfig: GoalInstanceConfig = {
  title: 'Goal',
  target: 10000,
  current: 0,
  reached: false,
  lastCompletedTarget: 0,
  reachedBehavior: 'increase',
  actionId: null,
  initialTarget: 10000,
  sessionId: null,
  lastLikeTotal: 0,
  barColor: '#8b5cf6',
  gradientColor: '#c084fc',
  backgroundColor: 'transparent',
  textColor: '#ffffff',
  showPercentage: true,
  showNumbers: true,
};
