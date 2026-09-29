// =============================================
// RosaeFinity — BrowserSourceId Legacy Migration Tests
// Verifies: non-UUID browserSourceIds are replaced
// with valid UUIDs on load, with idempotency and
// collision safety.
// =============================================

import { describe, it, expect } from 'vitest';

// ── Inline the migration logic for testing ──

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TestOverlayInstance {
  id: string;
  moduleId: string;
  name: string;
  enabled: boolean;
  browserSourceId: string;
  config: Record<string, unknown>;
  configVersion: number;
  createdAt: number;
  updatedAt: number;
  userId?: string;
  profileId?: string;
}

/**
 * Mirrors the migration logic from overlay-store.ts loadInstances()
 * Pure function — no Dexie, no Zustand, no Electron.
 */
function migrateBrowserSourceIds(instances: TestOverlayInstance[]): {
  migrated: TestOverlayInstance[];
  count: number;
  changes: Array<{ oldId: string; newId: string }>;
} {
  const existingIds = new Set(instances.map(i => i.browserSourceId));
  let count = 0;
  const changes: Array<{ oldId: string; newId: string }> = [];

  const migrated = instances.map(inst => {
    if (UUID_RE.test(inst.browserSourceId)) return inst;
    let newId: string;
    do { newId = crypto.randomUUID(); } while (existingIds.has(newId));
    existingIds.add(newId);
    existingIds.delete(inst.browserSourceId);
    count++;
    changes.push({ oldId: inst.browserSourceId, newId });
    return { ...inst, browserSourceId: newId };
  });

  return { migrated, count, changes };
}

function makeInstance(overrides: Partial<TestOverlayInstance> = {}): TestOverlayInstance {
  return {
    id: crypto.randomUUID(),
    moduleId: 'coin-jar',
    name: 'My Coin Jar',
    enabled: true,
    browserSourceId: crypto.randomUUID(),
    config: { goalCoins: 1000 },
    configVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    userId: 'user-1',
    profileId: 'profile-1',
    ...overrides,
  };
}

// ── Valid UUID ──

describe('UUID validation', () => {
  it('valid UUID passes regex', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(UUID_RE.test(id)).toBe(true);
  });

  it('uppercase UUID passes regex', () => {
    const id = '550E8400-E29B-41D4-A716-446655440000';
    expect(UUID_RE.test(id)).toBe(true);
  });

  it('legacy tmp_ ID fails regex', () => {
    expect(UUID_RE.test('tmp_nnp9gk9t')).toBe(false);
  });

  it('empty string fails regex', () => {
    expect(UUID_RE.test('')).toBe(false);
  });

  it('undefined-like string fails regex', () => {
    expect(UUID_RE.test('undefined')).toBe(false);
  });
});

// ── Valid UUID remains unchanged ──

describe('Valid UUID: no migration', () => {
  it('UUID browserSourceId remains unchanged', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const instance = makeInstance({ browserSourceId: id });
    const result = migrateBrowserSourceIds([instance]);

    expect(result.count).toBe(0);
    expect(result.migrated[0].browserSourceId).toBe(id);
  });

  it('multiple valid UUIDs remain unchanged', () => {
    const ids = [
      '550e8400-e29b-41d4-a716-446655440000',
      '660f9511-f3ac-52e5-b827-557766551111',
      '7710a622-a4bd-63f6-c938-668877662222',
    ];
    const instances = ids.map(id => makeInstance({ browserSourceId: id }));
    const result = migrateBrowserSourceIds(instances);

    expect(result.count).toBe(0);
    result.migrated.forEach((inst, i) => {
      expect(inst.browserSourceId).toBe(ids[i]);
    });
  });
});

// ── Legacy ID migration ──

describe('Legacy ID: migration', () => {
  it('tmp_ ID becomes valid UUID', () => {
    const instance = makeInstance({ browserSourceId: 'tmp_nnp9gk9t' });
    const result = migrateBrowserSourceIds([instance]);

    expect(result.count).toBe(1);
    expect(result.migrated[0].browserSourceId).not.toBe('tmp_nnp9gk9t');
    expect(UUID_RE.test(result.migrated[0].browserSourceId)).toBe(true);
    expect(result.changes[0].oldId).toBe('tmp_nnp9gk9t');
    expect(UUID_RE.test(result.changes[0].newId)).toBe(true);
  });

  it('arbitrary non-UUID string becomes valid UUID', () => {
    const instance = makeInstance({ browserSourceId: 'not-a-uuid-at-all' });
    const result = migrateBrowserSourceIds([instance]);

    expect(result.count).toBe(1);
    expect(UUID_RE.test(result.migrated[0].browserSourceId)).toBe(true);
  });

  it('numeric-only string becomes valid UUID', () => {
    const instance = makeInstance({ browserSourceId: '12345678' });
    const result = migrateBrowserSourceIds([instance]);

    expect(result.count).toBe(1);
    expect(UUID_RE.test(result.migrated[0].browserSourceId)).toBe(true);
  });
});

// ── Multiple legacy IDs ──

describe('Multiple legacy IDs: each gets unique UUID', () => {
  it('two legacy IDs receive different UUIDs', () => {
    const a = makeInstance({ browserSourceId: 'legacy-a' });
    const b = makeInstance({ browserSourceId: 'legacy-b' });
    const result = migrateBrowserSourceIds([a, b]);

    expect(result.count).toBe(2);
    expect(result.migrated[0].browserSourceId).not.toBe(result.migrated[1].browserSourceId);
    expect(UUID_RE.test(result.migrated[0].browserSourceId)).toBe(true);
    expect(UUID_RE.test(result.migrated[1].browserSourceId)).toBe(true);
  });

  it('mixed valid + legacy: only legacy migrated', () => {
    const valid = '550e8400-e29b-41d4-a716-446655440000';
    const a = makeInstance({ browserSourceId: valid });
    const b = makeInstance({ browserSourceId: 'legacy-x' });
    const c = makeInstance({ browserSourceId: 'legacy-y' });
    const result = migrateBrowserSourceIds([a, b, c]);

    expect(result.count).toBe(2);
    expect(result.migrated[0].browserSourceId).toBe(valid); // untouched
    expect(UUID_RE.test(result.migrated[1].browserSourceId)).toBe(true);
    expect(UUID_RE.test(result.migrated[2].browserSourceId)).toBe(true);
    expect(result.migrated[1].browserSourceId).not.toBe(result.migrated[2].browserSourceId);
  });
});

// ── Idempotency ──

describe('Idempotency', () => {
  it('migrated UUID remains unchanged on second pass', () => {
    const instance = makeInstance({ browserSourceId: 'legacy-z' });

    // First pass: migrate
    const first = migrateBrowserSourceIds([instance]);
    expect(first.count).toBe(1);
    const newId = first.migrated[0].browserSourceId;

    // Second pass: should be no-op (newId is a valid UUID)
    const second = migrateBrowserSourceIds(first.migrated);
    expect(second.count).toBe(0);
    expect(second.migrated[0].browserSourceId).toBe(newId);
  });

  it('multiple passes produce stable result', () => {
    const instances = [
      makeInstance({ browserSourceId: 'old-a' }),
      makeInstance({ browserSourceId: 'old-b' }),
    ];

    let current = instances;
    for (let i = 0; i < 5; i++) {
      const result = migrateBrowserSourceIds(current);
      current = result.migrated;
      // After first pass, all subsequent passes should migrate 0
      if (i > 0) {
        expect(result.count).toBe(0);
      }
    }

    // Final IDs are valid UUIDs and stable
    const finalIds = current.map(i => i.browserSourceId);
    const finalResult = migrateBrowserSourceIds(current);
    finalResult.migrated.forEach((inst, i) => {
      expect(inst.browserSourceId).toBe(finalIds[i]);
    });
  });
});

// ── Instance integrity ──

describe('Instance integrity: only browserSourceId changes', () => {
  it('instance.id is unchanged', () => {
    const original = makeInstance({ browserSourceId: 'legacy-1' });
    const result = migrateBrowserSourceIds([original]);

    expect(result.migrated[0].id).toBe(original.id);
  });

  it('moduleId is unchanged', () => {
    const original = makeInstance({ browserSourceId: 'legacy-2', moduleId: 'goal-likes' });
    const result = migrateBrowserSourceIds([original]);

    expect(result.migrated[0].moduleId).toBe('goal-likes');
  });

  it('name is unchanged', () => {
    const original = makeInstance({ browserSourceId: 'legacy-3', name: 'Custom Name' });
    const result = migrateBrowserSourceIds([original]);

    expect(result.migrated[0].name).toBe('Custom Name');
  });

  it('config is unchanged', () => {
    const config = { goalCoins: 5000, barColor: '#ff0000' };
    const original = makeInstance({ browserSourceId: 'legacy-4', config });
    const result = migrateBrowserSourceIds([original]);

    expect(result.migrated[0].config).toEqual(config);
  });

  it('userId is unchanged', () => {
    const original = makeInstance({ browserSourceId: 'legacy-5', userId: 'user-42' });
    const result = migrateBrowserSourceIds([original]);

    expect(result.migrated[0].userId).toBe('user-42');
  });

  it('profileId is unchanged', () => {
    const original = makeInstance({ browserSourceId: 'legacy-6', profileId: 'profile-7' });
    const result = migrateBrowserSourceIds([original]);

    expect(result.migrated[0].profileId).toBe('profile-7');
  });

  it('enabled is unchanged', () => {
    const original = makeInstance({ browserSourceId: 'legacy-7', enabled: false });
    const result = migrateBrowserSourceIds([original]);

    expect(result.migrated[0].enabled).toBe(false);
  });

  it('configVersion is unchanged', () => {
    const original = makeInstance({ browserSourceId: 'legacy-8', configVersion: 3 });
    const result = migrateBrowserSourceIds([original]);

    expect(result.migrated[0].configVersion).toBe(3);
  });
});

// ── Collision safety ──

describe('Collision safety', () => {
  it('generated UUID does not collide with existing UUIDs', () => {
    const existingId = '550e8400-e29b-41d4-a716-446655440000';
    const a = makeInstance({ browserSourceId: existingId });
    const b = makeInstance({ browserSourceId: 'legacy-collide' });
    const result = migrateBrowserSourceIds([a, b]);

    expect(result.migrated[0].browserSourceId).toBe(existingId);
    expect(result.migrated[1].browserSourceId).not.toBe(existingId);
    expect(result.migrated[1].browserSourceId).not.toBe('legacy-collide');
  });

  it('all migrated IDs are unique', () => {
    const instances = Array.from({ length: 50 }, (_, i) =>
      makeInstance({ browserSourceId: `legacy-${i}` })
    );
    const result = migrateBrowserSourceIds(instances);

    expect(result.count).toBe(50);
    const ids = result.migrated.map(i => i.browserSourceId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(50);
  });
});

// ── Regression: existing valid overlays untouched ──

describe('Regression: existing valid overlays', () => {
  it('100 valid UUID instances remain completely untouched', () => {
    const instances = Array.from({ length: 100 }, () => makeInstance());
    const originalIds = instances.map(i => i.browserSourceId);
    const result = migrateBrowserSourceIds(instances);

    expect(result.count).toBe(0);
    result.migrated.forEach((inst, i) => {
      expect(inst.browserSourceId).toBe(originalIds[i]);
    });
  });

  it('overlay configuration is never modified', () => {
    const configs = [
      { goalCoins: 1000, barColor: '#ff0000' },
      { goalCoins: 500, barColor: '#00ff00', textColor: '#ffffff' },
      {},
    ];
    const instances = configs.map((config, i) =>
      makeInstance({ browserSourceId: `legacy-regression-${i}`, config })
    );
    const result = migrateBrowserSourceIds(instances);

    result.migrated.forEach((inst, i) => {
      expect(inst.config).toEqual(configs[i]);
    });
  });
});

// ── Edge cases ──

describe('Edge cases', () => {
  it('empty instances array produces no migration', () => {
    const result = migrateBrowserSourceIds([]);
    expect(result.count).toBe(0);
    expect(result.migrated).toHaveLength(0);
  });

  it('single instance migration works', () => {
    const result = migrateBrowserSourceIds([makeInstance({ browserSourceId: 'solo' })]);
    expect(result.count).toBe(1);
    expect(UUID_RE.test(result.migrated[0].browserSourceId)).toBe(true);
  });

  it('instance with undefined-like browserSourceId is migrated', () => {
    const result = migrateBrowserSourceIds([makeInstance({ browserSourceId: 'undefined' })]);
    expect(result.count).toBe(1);
    expect(UUID_RE.test(result.migrated[0].browserSourceId)).toBe(true);
  });
});
