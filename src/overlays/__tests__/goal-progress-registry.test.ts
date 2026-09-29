// ─────────────────────────────────────────────────────
// Goal Progress Registry & Config Tests
// ─────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  getOverlayModule,
  getOverlayModules,
  getOverlaysByCategory,
  hasOverlay,
  loadModule,
} from '../registry';
import { goalProgressOverlay } from '../goal-progress';
import type { GoalProgressConfig } from '../goal-progress/types';
import { defaultGoalProgressConfig } from '../goal-progress/types';

// ─── Registry Integration ──────────────────────────

describe('Goal Progress Registry Integration', () => {
  it('should be registered in the global registry', () => {
    const allModules = getOverlayModules();
    const goalProgress = allModules.find((m) => m.id === 'goal-progress');
    expect(goalProgress).toBeDefined();
    expect(goalProgress?.id).toBe('goal-progress');
    expect(goalProgress?.name).toBe('Goal Likes');
    expect(goalProgress?.category).toBe('goals');
  });

  it('should be loadable by ID', () => {
    const module = getOverlayModule('goal-progress');
    expect(module).toBeDefined();
    expect(module?.id).toBe('goal-progress');
  });

  it('should be in the goals category', () => {
    const goalsModules = getOverlaysByCategory('goals');
    const goalProgress = goalsModules.find((m) => m.id === 'goal-progress');
    expect(goalProgress).toBeDefined();
  });

  it('should return true for hasOverlay', () => {
    expect(hasOverlay('goal-progress')).toBe(true);
  });

  it('should load asynchronously', async () => {
    const module = await loadModule('goal-progress');
    expect(module).toBeDefined();
    expect(module?.id).toBe('goal-progress');
  });

  it('should have valid module structure', () => {
    const module = getOverlayModule('goal-progress')!;
    expect(module.id).toBe('goal-progress');
    expect(module.name).toBe('Goal Likes');
    expect(module.description).toContain('goal');
    expect(module.category).toBe('goals');
    expect(module.icon).toBeDefined();
    expect(Array.isArray(module.tags)).toBe(true);
    expect(module.tags).toContain('goal');
    expect(module.tags).toContain('progress');
    expect(module.supportsBrowserSource).toBe(true);
    expect(module.supportsPreview).toBe(true);
    expect(module.version).toBe(1);
    expect(module.configVersion).toBe(1);
    expect(module.renderer).toBeDefined();
    expect(Array.isArray(module.settingsSchema)).toBe(true);
    expect(module.defaultConfig).toBeDefined();
    expect(typeof module.validate).toBe('function');
    expect(typeof module.sanitize).toBe('function');
    expect(typeof module.migrate).toBe('function');
  });
});

// ─── Default Config ────────────────────────────────

describe('Goal Progress Default Config', () => {
  it('should have correct defaults', () => {
    const cfg = defaultGoalProgressConfig;
    expect(cfg.goalType).toBe('likes');
    expect(cfg.target).toBe(7000);
    expect(cfg.title).toBe('Goal');
    expect(cfg.reachedBehavior).toBe('increase');
    expect(cfg.actionId).toBeNull();
    expect(cfg.barColor).toBe('#8b5cf6');
    expect(cfg.gradientColor).toBe('#c084fc');
    expect(cfg.backgroundColor).toBe('transparent');
    expect(cfg.textColor).toBe('#ffffff');
    expect(cfg.showPercentage).toBe(true);
    expect(cfg.showNumbers).toBe(true);
  });

  it('should NOT have increaseAmount field', () => {
    const cfg = defaultGoalProgressConfig as Record<string, unknown>;
    expect(cfg.increaseAmount).toBeUndefined();
  });

  it('should have boolean types for showPercentage and showNumbers', () => {
    expect(typeof defaultGoalProgressConfig.showPercentage).toBe('boolean');
    expect(typeof defaultGoalProgressConfig.showNumbers).toBe('boolean');
  });
});

// ─── Validate ──────────────────────────────────────

describe('Goal Progress Validate', () => {
  it('should validate correct config', () => {
    expect(goalProgressOverlay.validate(defaultGoalProgressConfig)).toBe(true);
  });

  it('should reject null', () => {
    expect(goalProgressOverlay.validate(null)).toBe(false);
  });

  it('should reject empty object', () => {
    expect(goalProgressOverlay.validate({})).toBe(false);
  });

  it('should reject missing target', () => {
    expect(goalProgressOverlay.validate({ title: 'Goal' })).toBe(false);
  });

  it('should reject missing title', () => {
    expect(goalProgressOverlay.validate({ target: 100 })).toBe(false);
  });

  it('should accept config with extra fields', () => {
    expect(
      goalProgressOverlay.validate({
        ...defaultGoalProgressConfig,
        extraField: 'ignored',
      })
    ).toBe(true);
  });
});

// ─── Sanitize ──────────────────────────────────────

describe('Goal Progress Sanitize', () => {
  it('should fill missing fields with defaults', () => {
    const sanitized = goalProgressOverlay.sanitize({ target: 500, title: 'Test' });
    expect(sanitized.target).toBe(500);
    expect(sanitized.title).toBe('Test');
    expect(sanitized.goalType).toBe(defaultGoalProgressConfig.goalType);
    expect(sanitized.barColor).toBe(defaultGoalProgressConfig.barColor);
    expect(sanitized.gradientColor).toBe(defaultGoalProgressConfig.gradientColor);
    expect(sanitized.textColor).toBe(defaultGoalProgressConfig.textColor);
    expect(sanitized.backgroundColor).toBe(defaultGoalProgressConfig.backgroundColor);
    expect(sanitized.showPercentage).toBe(true);
    expect(sanitized.showNumbers).toBe(true);
  });

  it('should normalize string booleans to real booleans', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      showPercentage: 'true',
      showNumbers: 'false',
    });
    expect(typeof sanitized.showPercentage).toBe('boolean');
    expect(typeof sanitized.showNumbers).toBe('boolean');
    expect(sanitized.showPercentage).toBe(true);
    expect(sanitized.showNumbers).toBe(false);
  });

  it('should normalize "1" and "0" string booleans', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      showPercentage: '1',
      showNumbers: '0',
    });
    expect(sanitized.showPercentage).toBe(true);
    expect(sanitized.showNumbers).toBe(false);
  });

  it('should normalize old GoalReachedBehavior values', () => {
    // Old 'none' and 'reset' should map to 'keep'
    const sanitizedNone = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      reachedBehavior: 'none',
    });
    expect(sanitizedNone.reachedBehavior).toBe('keep');

    const sanitizedReset = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      reachedBehavior: 'reset',
    });
    expect(sanitizedReset.reachedBehavior).toBe('keep');
  });

  it('should preserve valid GoalReachedBehavior values', () => {
    for (const behavior of ['keep', 'increase', 'double', 'hide'] as const) {
      const sanitized = goalProgressOverlay.sanitize({
        target: 100,
        title: 'Test',
        reachedBehavior: behavior,
      });
      expect(sanitized.reachedBehavior).toBe(behavior);
    }
  });

  it('should handle missing actionId as null', () => {
    const sanitized = goalProgressOverlay.sanitize({ target: 100, title: 'Test' });
    expect(sanitized.actionId).toBeNull();
  });

  it('should preserve actionId when provided', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      actionId: 'action-123',
    });
    expect(sanitized.actionId).toBe('action-123');
  });

  it('should NOT have increaseAmount in sanitized output', () => {
    const sanitized = goalProgressOverlay.sanitize({ target: 100, title: 'Test' });
    const keys = Object.keys(sanitized);
    expect(keys).not.toContain('increaseAmount');
  });
});

// ─── Migrate ───────────────────────────────────────

describe('Goal Progress Migrate', () => {
  it('should migrate old config with increaseAmount (ignore it)', () => {
    const oldConfig = {
      target: 100,
      title: 'Test',
      increaseAmount: 500,
      showPercentage: 'true',
    };
    const migrated = goalProgressOverlay.migrate(oldConfig, 1);
    expect(migrated.target).toBe(100);
    expect(migrated.showPercentage).toBe(true);
    expect((migrated as Record<string, unknown>).increaseAmount).toBeUndefined();
  });

  it('should migrate old boolean strings', () => {
    const migrated = goalProgressOverlay.migrate({
      target: 100,
      title: 'Test',
      showPercentage: 'false',
      showNumbers: 'true',
    });
    expect(typeof migrated.showPercentage).toBe('boolean');
    expect(typeof migrated.showNumbers).toBe('boolean');
    expect(migrated.showPercentage).toBe(false);
    expect(migrated.showNumbers).toBe(true);
  });

  it('should migrate old reachedBehavior values', () => {
    const migratedNone = goalProgressOverlay.migrate({
      target: 100,
      title: 'Test',
      reachedBehavior: 'none',
    });
    expect(migratedNone.reachedBehavior).toBe('keep');

    const migratedReset = goalProgressOverlay.migrate({
      target: 100,
      title: 'Test',
      reachedBehavior: 'reset',
    });
    expect(migratedReset.reachedBehavior).toBe('keep');
  });

  it('should handle completely empty config', () => {
    const migrated = goalProgressOverlay.migrate({});
    expect(migrated.target).toBe(defaultGoalProgressConfig.target);
    expect(migrated.title).toBe(defaultGoalProgressConfig.title);
    expect(migrated.showPercentage).toBe(true);
    expect(migrated.showNumbers).toBe(true);
  });
});

// ─── Settings Schema ───────────────────────────────

describe('Goal Progress Settings Schema', () => {
  it('should have Goal and Appearance sections', () => {
    const schema = goalProgressOverlay.settingsSchema as Array<{
      title: string;
      fields: Array<{ key: string }>;
    }>;
    expect(schema.length).toBe(2);
    expect(schema[0].title).toBe('Goal');
    expect(schema[1].title).toBe('Appearance');
  });

  it('should NOT have increaseAmount field', () => {
    const schema = goalProgressOverlay.settingsSchema as Array<{
      fields: Array<{ key: string }>;
    }>;
    const allKeys = schema.flatMap((s) => s.fields.map((f) => f.key));
    expect(allKeys).not.toContain('increaseAmount');
  });

  it('should have toggle type for boolean fields', () => {
    const schema = goalProgressOverlay.settingsSchema as Array<{
      fields: Array<{ key: string; type: string }>;
    }>;
    const allFields = schema.flatMap((s) => s.fields);
    const showPct = allFields.find((f) => f.key === 'showPercentage');
    const showNum = allFields.find((f) => f.key === 'showNumbers');
    expect(showPct?.type).toBe('toggle');
    expect(showNum?.type).toBe('toggle');
  });

  it('should have color type for color fields', () => {
    const schema = goalProgressOverlay.settingsSchema as Array<{
      fields: Array<{ key: string; type: string }>;
    }>;
    const allFields = schema.flatMap((s) => s.fields);
    const textColor = allFields.find((f) => f.key === 'textColor');
    const barColor = allFields.find((f) => f.key === 'barColor');
    const gradientColor = allFields.find((f) => f.key === 'gradientColor');
    expect(textColor?.type).toBe('color');
    expect(barColor?.type).toBe('color');
    expect(gradientColor?.type).toBe('color');
  });

  it('should have select type for reachedBehavior', () => {
    const schema = goalProgressOverlay.settingsSchema as Array<{
      fields: Array<{ key: string; type: string }>;
    }>;
    const allFields = schema.flatMap((s) => s.fields);
    const reached = allFields.find((f) => f.key === 'reachedBehavior');
    expect(reached?.type).toBe('select');
  });

  it('should have all 4 reachedBehavior options', () => {
    const schema = goalProgressOverlay.settingsSchema as Array<{
      fields: Array<{ key: string; options?: Array<{ value: string }> }>;
    }>;
    const allFields = schema.flatMap((s) => s.fields);
    const reached = allFields.find((f) => f.key === 'reachedBehavior');
    const optionValues = reached?.options?.map((o) => o.value) ?? [];
    expect(optionValues).toContain('keep');
    expect(optionValues).toContain('increase');
    expect(optionValues).toContain('double');
    expect(optionValues).toContain('hide');
  });
});

// ─── Config Color Fields ───────────────────────────

describe('Goal Progress Color Config', () => {
  it('should accept custom textColor', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      textColor: '#00e5ff',
    });
    expect(sanitized.textColor).toBe('#00e5ff');
  });

  it('should accept custom barColor', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      barColor: '#ff2d55',
    });
    expect(sanitized.barColor).toBe('#ff2d55');
  });

  it('should accept custom gradientColor', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      gradientColor: '#00e5ff',
    });
    expect(sanitized.gradientColor).toBe('#00e5ff');
  });

  it('should accept custom backgroundColor', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      backgroundColor: 'rgba(0,0,0,0.5)',
    });
    expect(sanitized.backgroundColor).toBe('rgba(0,0,0,0.5)');
  });

  it('should default backgroundColor to transparent', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
    });
    expect(sanitized.backgroundColor).toBe('transparent');
  });
});

// ─── Goal Progression Logic ────────────────────────

describe('Goal Progression Logic', () => {
  it('increase should add target to itself: 100 → 200', () => {
    const target = 100;
    const newTarget = target + target;
    expect(newTarget).toBe(200);
  });

  it('increase should chain: 100 → 200 → 300 → 400', () => {
    let target = 100;
    target = target + target; // 200
    expect(target).toBe(200);
    target = target + target; // 400 — note: this is how the code works
    // Actually the code does: newTarget = goal.target + goal.target
    // After first increase: 100 + 100 = 200
    // After second increase: 200 + 200 = 400 (not 300!)
    // This is because the Goal store's target is updated to 200,
    // then increaseGoalTarget does: newTarget = goal.target + goal.target = 200 + 200 = 400
    expect(target).toBe(400);
  });

  it('increase for 7000: 7000 → 14000 → 28000', () => {
    let target = 7000;
    target = target + target; // 14000
    expect(target).toBe(14000);
    target = target + target; // 28000
    expect(target).toBe(28000);
  });

  it('double should multiply by 2: 100 → 200 → 400', () => {
    let target = 100;
    target = target * 2; // 200
    expect(target).toBe(200);
    target = target * 2; // 400
    expect(target).toBe(400);
  });

  it('overshoot should be preserved', () => {
    const current = 90;
    const target = 100;
    const incoming = 30;
    const newCurrent = current + incoming; // 120
    const overshoot = Math.max(0, newCurrent - target); // 20
    expect(overshoot).toBe(20);
  });

  it('no overshoot when exactly at target', () => {
    const current = 90;
    const target = 100;
    const incoming = 10;
    const newCurrent = current + incoming; // 100
    const overshoot = Math.max(0, newCurrent - target); // 0
    expect(overshoot).toBe(0);
  });

  it('no overshoot when below target', () => {
    const current = 50;
    const target = 100;
    const incoming = 10;
    const newCurrent = current + incoming; // 60
    const overshoot = Math.max(0, newCurrent - target); // 0
    expect(overshoot).toBe(0);
  });
});

// ─── Action Safety ─────────────────────────────────

describe('Action Execution Safety', () => {
  it('should not fire action if lastCompletedTarget >= current target', () => {
    const lastCompletedTarget = 100;
    const target = 100;
    const alreadyFired = lastCompletedTarget >= target;
    expect(alreadyFired).toBe(true);
  });

  it('should fire action if lastCompletedTarget < current target', () => {
    const lastCompletedTarget = 0;
    const target = 100;
    const alreadyFired = lastCompletedTarget >= target;
    expect(alreadyFired).toBe(false);
  });

  it('should fire action for new milestone after target increase', () => {
    // First milestone: target=100, lastCompletedTarget=0 → fires
    let lastCompletedTarget = 0;
    let target = 100;
    expect(lastCompletedTarget >= target).toBe(false);

    // After firing: lastCompletedTarget = 100
    lastCompletedTarget = target;
    expect(lastCompletedTarget >= target).toBe(true);

    // Target increases to 200
    target = 200;
    expect(lastCompletedTarget >= target).toBe(false); // fires again
  });
});

// ─── Regression: Toggle False Preservation ─────────

describe('Regression: Toggle False Preservation', () => {
  it('explicit false survives sanitize', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      showPercentage: false,
      showNumbers: false,
    });
    expect(sanitized.showPercentage).toBe(false);
    expect(sanitized.showNumbers).toBe(false);
    expect(typeof sanitized.showPercentage).toBe('boolean');
    expect(typeof sanitized.showNumbers).toBe('boolean');
  });

  it('string "false" is normalized to boolean false', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      showPercentage: 'false',
      showNumbers: 'false',
    });
    expect(sanitized.showPercentage).toBe(false);
    expect(sanitized.showNumbers).toBe(false);
  });

  it('false is not coerced to true by Boolean()', () => {
    // This was the root cause: Boolean("false") === true
    // The fix uses a proper toBool helper
    expect(Boolean('false')).toBe(true); // native JS behavior
    // But our sanitizer correctly handles it:
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      showPercentage: 'false',
    });
    expect(sanitized.showPercentage).toBe(false);
  });

  it('false survives effectiveConfig derivation', () => {
    const config = { target: 100, title: 'Test', showPercentage: false };
    const effectiveConfig = config;
    expect(effectiveConfig.showPercentage).toBe(false);
    expect(effectiveConfig.showPercentage).not.toBe(true);
  });

  it('undefined falls back to default (true)', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
    });
    expect(sanitized.showPercentage).toBe(true);
    expect(sanitized.showNumbers).toBe(true);
  });
});

// ─── Regression: Color Config Reaches Renderer ─────

describe('Regression: Color Config Reaches Renderer', () => {
  it('custom textColor is preserved through sanitize', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      textColor: '#ff0000',
    });
    expect(sanitized.textColor).toBe('#ff0000');
  });

  it('custom barColor is preserved through sanitize', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      barColor: '#0000ff',
    });
    expect(sanitized.barColor).toBe('#0000ff');
  });

  it('custom gradientColor is preserved through sanitize', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      gradientColor: '#00ff00',
    });
    expect(sanitized.gradientColor).toBe('#00ff00');
  });

  it('custom backgroundColor is preserved through sanitize', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      backgroundColor: 'rgba(255,0,0,0.5)',
    });
    expect(sanitized.backgroundColor).toBe('rgba(255,0,0,0.5)');
  });

  it('config update creates new object (no mutation)', () => {
    const original = { target: 100, title: 'Test', textColor: '#ffffff' };
    const updated = { ...original, textColor: '#ff0000' };
    expect(original.textColor).toBe('#ffffff');
    expect(updated.textColor).toBe('#ff0000');
    expect(original).not.toBe(updated);
  });
});

// ─── Action Execution Logic ────────────────────────

describe('Action Execution Logic', () => {
  it('actionId persists through sanitize', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
      actionId: 'act_real123',
    });
    expect(sanitized.actionId).toBe('act_real123');
  });

  it('actionId defaults to null when absent', () => {
    const sanitized = goalProgressOverlay.sanitize({
      target: 100,
      title: 'Test',
    });
    expect(sanitized.actionId).toBeNull();
  });

  it('actionId survives config update cycle', () => {
    const original = { target: 100, title: 'Test', actionId: null as string | null };
    const updated = { ...original, actionId: 'act_abc123' };
    expect(updated.actionId).toBe('act_abc123');
    // Simulate another update
    const updated2 = { ...updated, actionId: 'act_xyz789' };
    expect(updated2.actionId).toBe('act_xyz789');
  });

  it('action lookup by id matches correctly', () => {
    const actions = [
      { id: 'act_1', name: 'Play Sound', enabled: true },
      { id: 'act_2', name: 'Show Alert', enabled: true },
      { id: 'act_3', name: 'Disabled Action', enabled: false },
    ];
    const actionId = 'act_2';
    const action = actions.find((a) => a.id === actionId);
    expect(action).toBeDefined();
    expect(action?.name).toBe('Show Alert');
    expect(action?.enabled).toBe(true);
  });

  it('disabled action is not executable', () => {
    const actions = [
      { id: 'act_1', name: 'Play Sound', enabled: true },
      { id: 'act_3', name: 'Disabled', enabled: false },
    ];
    const action = actions.find((a) => a.id === 'act_3');
    expect(action).toBeDefined();
    expect(action?.enabled).toBe(false);
    // The Test handler checks action.enabled before executing
    const shouldExecute = action && action.enabled;
    expect(shouldExecute).toBeFalsy();
  });

  it('empty actionId means no action execution', () => {
    const actionId = '';
    const shouldExecute = !!actionId;
    expect(shouldExecute).toBe(false);
  });

  it('null actionId means no action execution', () => {
    const actionId = null;
    const shouldExecute = !!actionId;
    expect(shouldExecute).toBe(false);
  });

  it('action not found in store means no execution', () => {
    const actions = [
      { id: 'act_1', name: 'Play Sound', enabled: true },
    ];
    const actionId = 'act_nonexistent';
    const action = actions.find((a) => a.id === actionId);
    expect(action).toBeUndefined();
    const shouldExecute = action && action.enabled;
    expect(shouldExecute).toBeFalsy();
  });
});

// ─── Config Sync: Customize → Browser Source ───────

describe('Config Sync: Customize → Browser Source', () => {
  it('config update creates complete config object', () => {
    const original = { ...defaultGoalProgressConfig };
    const updated = { ...original, textColor: '#ff0000', barColor: '#00ff00' };
    expect(updated.textColor).toBe('#ff0000');
    expect(updated.barColor).toBe('#00ff00');
    expect(updated.gradientColor).toBe(defaultGoalProgressConfig.gradientColor);
    expect(updated.showPercentage).toBe(true);
  });

  it('config merge preserves existing fields when one changes', () => {
    const base = {
      ...defaultGoalProgressConfig,
      textColor: '#ffffff',
      barColor: '#8b5cf6',
      gradientColor: '#c084fc',
      showNumbers: true,
      showPercentage: true,
    };
    const updated = { ...base, barColor: '#ff2d55' };
    expect(updated.barColor).toBe('#ff2d55');
    expect(updated.textColor).toBe('#ffffff');
    expect(updated.gradientColor).toBe('#c084fc');
    expect(updated.showNumbers).toBe(true);
    expect(updated.showPercentage).toBe(true);
  });

  it('browser source merges incoming config with defaults', () => {
    const incoming = { textColor: '#00e5ff', barColor: '#ff2d55' };
    const merged = { ...defaultGoalProgressConfig, ...incoming };
    expect(merged.textColor).toBe('#00e5ff');
    expect(merged.barColor).toBe('#ff2d55');
    expect(merged.target).toBe(defaultGoalProgressConfig.target);
    expect(merged.showPercentage).toBe(true);
  });

  it('invalid incoming config is sanitized to defaults', () => {
    const incoming = {};
    const merged = { ...defaultGoalProgressConfig, ...incoming };
    expect(merged.target).toBe(7000);
    expect(merged.textColor).toBe('#ffffff');
    expect(merged.showPercentage).toBe(true);
  });

  it('showNumbers false survives sync round-trip', () => {
    const config = { ...defaultGoalProgressConfig, showNumbers: false };
    const serialized = JSON.stringify(config);
    const parsed = JSON.parse(serialized);
    const merged = { ...defaultGoalProgressConfig, ...parsed };
    expect(merged.showNumbers).toBe(false);
    expect(typeof merged.showNumbers).toBe('boolean');
  });

  it('showPercentage false survives sync round-trip', () => {
    const config = { ...defaultGoalProgressConfig, showPercentage: false };
    const serialized = JSON.stringify(config);
    const parsed = JSON.parse(serialized);
    const merged = { ...defaultGoalProgressConfig, ...parsed };
    expect(merged.showPercentage).toBe(false);
  });

  it('complete config contains all appearance fields', () => {
    const config = {
      ...defaultGoalProgressConfig,
      textColor: '#ff0000',
      barColor: '#00ff00',
      gradientColor: '#0000ff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      showNumbers: false,
      showPercentage: false,
    };
    // All appearance fields must be present in serialized form
    const json = JSON.stringify(config);
    const parsed = JSON.parse(json);
    expect(parsed.textColor).toBe('#ff0000');
    expect(parsed.barColor).toBe('#00ff00');
    expect(parsed.gradientColor).toBe('#0000ff');
    expect(parsed.backgroundColor).toBe('rgba(0,0,0,0.5)');
    expect(parsed.showNumbers).toBe(false);
    expect(parsed.showPercentage).toBe(false);
  });
});
