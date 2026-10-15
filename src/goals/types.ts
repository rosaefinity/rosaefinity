// =============================================
// RosaeFinity — Goal Types
// =============================================

export type GoalType = 'likes' | 'followers' | 'gifts';

export type GoalReachedBehavior = 'keep' | 'increase' | 'double' | 'hide';

export interface Goal {
  id: string;
  type: GoalType;
  target: number;
  title: string;
  reachedBehavior: GoalReachedBehavior;
  increaseAmount: number;
  /** Original configured target — step size for 'increase' mode
   *  (newTarget = oldTarget + initialTarget). Set at creation and on
   *  user target edits; NOT modified by system-driven increase/double. */
  initialTarget?: number;
  actionId: string | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  /** Account owner — stamped at creation time. Goals without userId are legacy/unowned. */
  userId?: string;
  /** Color settings synced from Goal overlay config */
  barColor?: string;
  gradientColor?: string;
  textColor?: string;
  backgroundColor?: string;
}

/** Runtime goal state (persisted to localStorage rf-goals-runtime) */
export interface GoalRuntime {
  goalId: string;
  current: number;
  reached: boolean;
  /** Tracks the last target for which the completion action was fired.
   *  Prevents duplicate action execution across events. */
  lastCompletedTarget: number;
  /** LIVE-session identity (TikTok roomId) this progress belongs to. */
  sessionId?: string | null;
  /** Last observed cumulative like total for session-delta math. */
  lastLikeTotal?: number;
}
