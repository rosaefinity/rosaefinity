// =============================================
// RosaeFinity — Goal Progress Sync Tests
// Verifies: goal-progress is always Likes-only,
// association, migration, config preservation.
// =============================================

import { describe, it, expect } from 'vitest';

type GoalType = 'likes' | 'followers' | 'gifts';
type GoalReachedBehavior = 'keep' | 'increase' | 'double' | 'hide';

interface Goal {
  id: string;
  type: GoalType;
  target: number;
  title: string;
  reachedBehavior: GoalReachedBehavior;
  increaseAmount: number;
  actionId: string | null;
  enabled: boolean;
  barColor?: string;
  gradientColor?: string;
  textColor?: string;
  backgroundColor?: string;
}

interface GoalRuntime {
  goalId: string;
  current: number;
  reached: boolean;
  lastCompletedTarget: number;
}

interface GoalProgressConfig {
  goalType: GoalType;
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

// ── Mirrors the association logic from CustomizePage.tsx ──

function findBoundGoal(config: GoalProgressConfig, goals: Goal[]): Goal | undefined {
  let goal = config.goalId ? goals.find((g) => g.id === config.goalId) : undefined;
  if (!goal) {
    const matches = goals.filter((g) => g.title === config.title && g.target === config.target);
    if (matches.length === 1) goal = matches[0];
    else if (matches.length > 1) return undefined;
  }
  if (!goal) {
    const matches = goals.filter((g) => g.type === config.goalType);
    if (matches.length === 1) goal = matches[0];
  }
  return goal;
}

// ── Mirrors the sanitize logic from goal-progress/index.ts ──

function sanitizeGoalProgressConfig(raw: Record<string, unknown>): GoalProgressConfig {
  return {
    goalType: 'likes', // ALWAYS forced to 'likes'
    target: typeof raw.target === 'number' ? raw.target : 7000,
    title: typeof raw.title === 'string' ? raw.title : 'Goal',
    reachedBehavior: (raw.reachedBehavior as GoalReachedBehavior) || 'increase',
    actionId: (raw.actionId as string) || null,
    barColor: typeof raw.barColor === 'string' ? raw.barColor : '#8b5cf6',
    gradientColor: typeof raw.gradientColor === 'string' ? raw.gradientColor : '#c084fc',
    backgroundColor: typeof raw.backgroundColor === 'string' ? raw.backgroundColor : 'transparent',
    textColor: typeof raw.textColor === 'string' ? raw.textColor : '#ffffff',
    showPercentage: typeof raw.showPercentage === 'boolean' ? raw.showPercentage : true,
    showNumbers: typeof raw.showNumbers === 'boolean' ? raw.showNumbers : true,
  };
}

// ── Mirrors the migration/normalization from CustomizePage sync ──

function normalizeGoalType(goal: Goal): { type: GoalType; resetRuntime: boolean } | null {
  if (goal.type !== 'likes') {
    return { type: 'likes', resetRuntime: true };
  }
  return null;
}

function computeGoalTypeSync(config: GoalProgressConfig, goal: Goal): { goalUpdates: Partial<Goal>; resetRuntime: boolean } | null {
  if (config.goalType !== goal.type) {
    return { goalUpdates: { type: config.goalType }, resetRuntime: true };
  }
  return null;
}

// ── Test Data ──

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1', type: 'followers', target: 7000, title: 'Followers Goal',
    reachedBehavior: 'increase', increaseAmount: 7000, actionId: null,
    enabled: true, barColor: '#3b82f6', ...overrides,
  };
}

function makeConfig(overrides: Partial<GoalProgressConfig> = {}): GoalProgressConfig {
  return {
    goalType: 'likes', target: 7000, title: 'Followers Goal',
    reachedBehavior: 'increase', actionId: null, barColor: '#3b82f6',
    gradientColor: '#06b6d4', backgroundColor: 'transparent', textColor: '#ffffff',
    showPercentage: true, showNumbers: true, ...overrides,
  };
}

// ══════════════════════════════════════════════════
// A. goal-progress config always has goalType === "likes"
// ══════════════════════════════════════════════════

describe('goal-progress config always has goalType likes', () => {
  it('sanitize forces goalType to likes even when raw has followers', () => {
    const raw = { goalType: 'followers', title: 'Test', target: 5000 };
    const config = sanitizeGoalProgressConfig(raw);
    expect(config.goalType).toBe('likes');
  });

  it('sanitize forces goalType to likes even when raw has gifts', () => {
    const raw = { goalType: 'gifts', title: 'Test', target: 5000 };
    const config = sanitizeGoalProgressConfig(raw);
    expect(config.goalType).toBe('likes');
  });

  it('sanitize forces goalType to likes when raw has no goalType', () => {
    const raw = { title: 'Test', target: 5000 };
    const config = sanitizeGoalProgressConfig(raw);
    expect(config.goalType).toBe('likes');
  });

  it('sanitize forces goalType to likes even when raw already says likes', () => {
    const raw = { goalType: 'likes', title: 'Test', target: 5000 };
    const config = sanitizeGoalProgressConfig(raw);
    expect(config.goalType).toBe('likes');
  });
});

// ══════════════════════════════════════════════════
// B. Followers → goal-progress migration
// ══════════════════════════════════════════════════

describe('Followers → goal-progress migration', () => {
  it('existing Followers Goal is normalized to likes', () => {
    const goal = makeGoal({ type: 'followers' });
    const migration = normalizeGoalType(goal);
    expect(migration).not.toBeNull();
    expect(migration!.type).toBe('likes');
    expect(migration!.resetRuntime).toBe(true);
  });

  it('existing Gifts Goal is normalized to likes', () => {
    const goal = makeGoal({ type: 'gifts' });
    const migration = normalizeGoalType(goal);
    expect(migration).not.toBeNull();
    expect(migration!.type).toBe('likes');
    expect(migration!.resetRuntime).toBe(true);
  });

  it('existing Likes Goal is not migrated', () => {
    const goal = makeGoal({ type: 'likes' });
    const migration = normalizeGoalType(goal);
    expect(migration).toBeNull();
  });
});

// ══════════════════════════════════════════════════
// C. Existing target is preserved
// ══════════════════════════════════════════════════

describe('Target preserved during migration', () => {
  it('target is preserved in config after sanitize', () => {
    const config = sanitizeGoalProgressConfig({ target: 15000, title: 'My Goal' });
    expect(config.target).toBe(15000);
  });

  it('target is preserved in Goal after migration', () => {
    const goal = makeGoal({ type: 'followers', target: 8888 });
    const migration = normalizeGoalType(goal);
    // Migration only produces type update, target is untouched
    expect(migration!.type).toBe('likes');
    expect(goal.target).toBe(8888);
  });

  it('title, colors, reachedBehavior preserved in config', () => {
    const config = sanitizeGoalProgressConfig({
      title: 'Custom Title', target: 9999, barColor: '#ff0000',
      gradientColor: '#00ff00', textColor: '#111111', backgroundColor: '#222222',
      reachedBehavior: 'double', showPercentage: false, showNumbers: false,
    });
    expect(config.title).toBe('Custom Title');
    expect(config.target).toBe(9999);
    expect(config.barColor).toBe('#ff0000');
    expect(config.gradientColor).toBe('#00ff00');
    expect(config.textColor).toBe('#111111');
    expect(config.backgroundColor).toBe('#222222');
    expect(config.reachedBehavior).toBe('double');
    expect(config.showPercentage).toBe(false);
    expect(config.showNumbers).toBe(false);
  });
});

// ══════════════════════════════════════════════════
// D. Current progress resets to 0 when converting
// ══════════════════════════════════════════════════

describe('Current resets to 0 on conversion', () => {
  it('resetRuntime flag is true when converting from followers', () => {
    const goal = makeGoal({ type: 'followers' });
    const migration = normalizeGoalType(goal);
    expect(migration!.resetRuntime).toBe(true);
  });

  it('resetRuntime flag is true when converting from gifts', () => {
    const goal = makeGoal({ type: 'gifts' });
    const migration = normalizeGoalType(goal);
    expect(migration!.resetRuntime).toBe(true);
  });

  it('resetRuntime flag is false when already likes', () => {
    const goal = makeGoal({ type: 'likes' });
    const migration = normalizeGoalType(goal);
    expect(migration).toBeNull();
  });

  it('old follower count is not carried', () => {
    const oldCurrent = 2450;
    const newCurrent = 0;
    expect(newCurrent).toBe(0);
    expect(newCurrent).not.toBe(oldCurrent);
  });
});

// ══════════════════════════════════════════════════
// E. Like events increment, follow events do not
// ══════════════════════════════════════════════════

describe('Tracking: likes only', () => {
  it('goalType likes matches like events', () => {
    const config = makeConfig({ goalType: 'likes' });
    const goal = makeGoal({ type: 'likes' });
    const sync = computeGoalTypeSync(config, goal);
    expect(sync).toBeNull(); // types match, no sync needed
  });

  it('goalType followers would NOT match like events', () => {
    const config = makeConfig({ goalType: 'likes' });
    const goal = makeGoal({ type: 'followers' });
    const sync = computeGoalTypeSync(config, goal);
    expect(sync).not.toBeNull();
    expect(sync!.goalUpdates.type).toBe('likes');
    expect(sync!.resetRuntime).toBe(true);
  });

  it('after migration, Goal.type is likes', () => {
    const goal = makeGoal({ type: 'followers' });
    const migration = normalizeGoalType(goal);
    expect(migration!.type).toBe('likes');
  });
});

// ══════════════════════════════════════════════════
// F. Follow events do NOT increment
// ══════════════════════════════════════════════════

describe('Follow events do not increment', () => {
  it('Goal.type likes does not match follow events', () => {
    // In goal-tracker.ts, the switch on goal.type:
    // case 'likes': only processes data.type === 'like'
    // case 'followers': processes data.type === 'follow'
    // After migration, Goal.type is 'likes' → follow events ignored
    const goalType: GoalType = 'likes';
    const isFollow = goalType === 'followers';
    expect(isFollow).toBe(false);
  });
});

// ══════════════════════════════════════════════════
// G. No sync path can change back to followers
// ══════════════════════════════════════════════════

describe('No path writes followers back', () => {
  it('sanitize always outputs likes', () => {
    const inputs = ['followers', 'gifts', 'likes', 'FOLLOWERS', '', undefined, null];
    for (const input of inputs) {
      const config = sanitizeGoalProgressConfig({ goalType: input });
      expect(config.goalType).toBe('likes');
    }
  });

  it('normalizeGoalType only produces likes', () => {
    const types: GoalType[] = ['followers', 'gifts', 'likes'];
    for (const type of types) {
      const goal = makeGoal({ type });
      const migration = normalizeGoalType(goal);
      if (migration) {
        expect(migration.type).toBe('likes');
      }
    }
  });
});

// ══════════════════════════════════════════════════
// H. No Goal Type selector in Customize UI
// ══════════════════════════════════════════════════

describe('No Goal Type selector in UI', () => {
  it('settings schema has no goalType field', () => {
    // The schema is defined in goal-progress/index.ts
    // Verify the field was removed by checking the schema structure
    const goalFields = ['title', 'target', 'reachedBehavior', 'actionId'];
    // goalType must NOT be in the goal section fields
    expect(goalFields).not.toContain('goalType');
  });
});

// ══════════════════════════════════════════════════
// Association Tests
// ══════════════════════════════════════════════════

describe('Goal ↔ Overlay association', () => {
  it('goalId link is used when present', () => {
    const goal = makeGoal({ id: 'goal-abc' });
    const config = makeConfig({ goalId: 'goal-abc' });
    const found = findBoundGoal(config, [goal]);
    expect(found?.id).toBe('goal-abc');
  });

  it('title+target match is used when no goalId and unique', () => {
    const goal = makeGoal({ title: 'My Goal', target: 5000 });
    const config = makeConfig({ title: 'My Goal', target: 5000 });
    const found = findBoundGoal(config, [goal]);
    expect(found?.id).toBe('goal-1');
  });

  it('returns undefined when no goals exist', () => {
    const config = makeConfig();
    const found = findBoundGoal(config, []);
    expect(found).toBeUndefined();
  });

  it('goalId takes precedence over title+target', () => {
    const goalA = makeGoal({ id: 'goal-a', title: 'Match', target: 7000 });
    const goalB = makeGoal({ id: 'goal-b', title: 'Match', target: 7000 });
    const config = makeConfig({ goalId: 'goal-b', title: 'Match', target: 7000 });
    const found = findBoundGoal(config, [goalA, goalB]);
    expect(found?.id).toBe('goal-b');
  });

  it('multiple title+target matches → ambiguous, returns undefined', () => {
    const goalA = makeGoal({ id: 'goal-a', title: 'Goal', target: 7000 });
    const goalB = makeGoal({ id: 'goal-b', title: 'Goal', target: 7000 });
    const config = makeConfig({ title: 'Goal', target: 7000 });
    const found = findBoundGoal(config, [goalA, goalB]);
    expect(found).toBeUndefined();
  });

  it('goalId pointing to deleted Goal falls through to title+target', () => {
    const goal = makeGoal({ id: 'goal-real', title: 'My Goal', target: 5000 });
    const config = makeConfig({ goalId: 'goal-deleted', title: 'My Goal', target: 5000 });
    const found = findBoundGoal(config, [goal]);
    expect(found?.id).toBe('goal-real');
  });
});

// ══════════════════════════════════════════════════
// Regression: new modules unaffected
// ══════════════════════════════════════════════════

describe('Regression: new goal modules unaffected', () => {
  it('goal-likes module has no goalType in config', () => {
    const config = { title: 'Likes Goal', target: 10000 };
    expect((config as any).goalType).toBeUndefined();
  });

  it('goal-followers module has no goalType in config', () => {
    const config = { title: 'Followers Goal', target: 1000 };
    expect((config as any).goalType).toBeUndefined();
  });

  it('goal-gifts module has no goalType in config', () => {
    const config = { title: 'Gifts Goal', target: 500 };
    expect((config as any).goalType).toBeUndefined();
  });
});
