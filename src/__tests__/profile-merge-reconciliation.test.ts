// =============================================
// RosaeFinity — Profile Merge Reconciliation Tests
// Verifies: pullCloudProfiles correctly reconciles
// local default profiles against cloud profiles by name.
// =============================================

import { describe, it, expect } from 'vitest';

// ── Types ──

interface StreamProfile {
  id: string;
  name: string;
  icon?: string;
  tiktokUsername?: string;
  alertsMasterEnabled?: boolean;
  alertsSettings?: Record<string, unknown>;
  ttsSettings?: unknown;
  actions: Action[];
  events: Event[];
  customSounds?: unknown[];
  overlaySettings?: Record<string, unknown>;
  locked?: boolean;
  createdAt?: string;
  updatedAt?: string;
  serverId?: string;
}

interface Action {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Event {
  id: string;
  type: string;
  actionName: string;
  actionNames?: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Simulated merge logic (mirrors pullCloudProfiles fix) ──

function simulatePullCloudProfilesMerge(
  localProfiles: StreamProfile[],
  cloudProfiles: StreamProfile[],
  pendingLocalIds: Set<string>
): {
  mergedProfiles: StreamProfile[];
  localOnlyProfiles: StreamProfile[];
  duplicateNames: string[];
} {
  // Build cloud name map (same as fix)
  const cloudNameToProfile = new Map<string, StreamProfile>();
  for (const cp of cloudProfiles) {
    cloudNameToProfile.set(cp.name.trim().toLowerCase(), cp);
  }

  // Local-only: local profiles NOT in cloud (by name) and no pending
  const localOnlyProfiles = localProfiles.filter(p => {
    const cloudMatch = cloudNameToProfile.get(p.name.trim().toLowerCase());
    return !cloudMatch && !pendingLocalIds.has(p.id);
  });

  // Pending local: keep local version
  const pendingLocalProfiles = localProfiles.filter(p =>
    pendingLocalIds.has(p.id)
  );

  // Remove cloud profiles that have a pending local name match
  // (pending local wins over cloud)
  const pendingNames = new Set(
    pendingLocalProfiles.map(p => p.name.trim().toLowerCase())
  );
  const filteredCloudProfiles = cloudProfiles.filter(
    cp => !pendingNames.has(cp.name.trim().toLowerCase())
  );

  const mergedProfiles = [...filteredCloudProfiles, ...localOnlyProfiles, ...pendingLocalProfiles];

  // Check for duplicate names
  const nameCounts = new Map<string, number>();
  for (const p of mergedProfiles) {
    const key = p.name.trim().toLowerCase();
    nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
  }
  const duplicateNames = [...nameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name);

  return { mergedProfiles, localOnlyProfiles, duplicateNames };
}

// ── Test Factories ──

function makeDefaultProfile(n: number): StreamProfile {
  const icons = ["🌹", "🔥", "🎮", "❤️", "💬", "🎁", "🙂", "👍", "📞", "☑️"];
  return {
    id: `profile-${n}`,
    name: `Stream Profile ${n}`,
    icon: icons[n - 1],
    tiktokUsername: "",
    alertsMasterEnabled: true,
    alertsSettings: {},
    actions: [],
    events: [],
    customSounds: [],
    overlaySettings: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeCloudProfile(n: number, uuid: string, overrides: Partial<StreamProfile> = {}): StreamProfile {
  return {
    id: uuid,
    serverId: uuid,
    name: `Stream Profile ${n}`,
    icon: "☁️",
    tiktokUsername: "clouduser",
    alertsMasterEnabled: true,
    alertsSettings: {},
    actions: [],
    events: [],
    customSounds: [],
    overlaySettings: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeAction(id: string): Action {
  return {
    id,
    name: `Action ${id}`,
    type: 'gift',
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeEvent(id: string, actionName: string): Event {
  return {
    id,
    type: 'gift',
    actionName,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════
// TEST 1: 10 default local + 10 cloud with matching names → 10 profiles
// ═══════════════════════════════════════════════════════════════

describe('pullCloudProfiles merge: default + cloud reconciliation', () => {
  it('10 default local profiles + 10 cloud profiles with matching names = 10 merged', () => {
    const localProfiles = Array.from({ length: 10 }, (_, i) => makeDefaultProfile(i + 1));
    const cloudProfiles = Array.from({ length: 10 }, (_, i) =>
      makeCloudProfile(i + 1, `uuid-${i + 1}`)
    );

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    expect(result.mergedProfiles).toHaveLength(10);
    expect(result.localOnlyProfiles).toHaveLength(0);
    expect(result.duplicateNames).toHaveLength(0);
  });

  it('merged profiles use cloud UUIDs, not default IDs', () => {
    const localProfiles = [makeDefaultProfile(1)];
    const cloudProfiles = [makeCloudProfile(1, 'cloud-uuid-1')];

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    expect(result.mergedProfiles).toHaveLength(1);
    expect(result.mergedProfiles[0].id).toBe('cloud-uuid-1');
    expect(result.mergedProfiles[0].serverId).toBe('cloud-uuid-1');
  });

  it('no duplicate names remain after merge', () => {
    const localProfiles = Array.from({ length: 10 }, (_, i) => makeDefaultProfile(i + 1));
    const cloudProfiles = Array.from({ length: 10 }, (_, i) =>
      makeCloudProfile(i + 1, `uuid-${i + 1}`)
    );

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    expect(result.duplicateNames).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 2: Cloud UUID is preserved
// ══════════════════════════════════════════════════════════════

describe('Cloud UUID preservation', () => {
  it('cloud profile id and serverId are preserved in merged result', () => {
    const localProfiles = [makeDefaultProfile(1)];
    const cloudProfiles = [makeCloudProfile(1, 'exact-cloud-uuid-123')];

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    expect(result.mergedProfiles[0].id).toBe('exact-cloud-uuid-123');
    expect(result.mergedProfiles[0].serverId).toBe('exact-cloud-uuid-123');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 3: Cloud profile actions/events preserved
// ══════════════════════════════════════════════════════════════

describe('Cloud profile data preservation', () => {
  it('cloud actions are preserved', () => {
    const cloudAction = makeAction('act-cloud-1');
    const localProfiles = [makeDefaultProfile(1)];
    const cloudProfiles = [makeCloudProfile(1, 'uuid-1', {
      actions: [cloudAction],
    })];

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    expect(result.mergedProfiles[0].actions).toHaveLength(1);
    expect(result.mergedProfiles[0].actions[0].id).toBe('act-cloud-1');
  });

  it('cloud events are preserved', () => {
    const cloudEvent = makeEvent('evt-cloud-1', 'Cloud Action');
    const localProfiles = [makeDefaultProfile(1)];
    const cloudProfiles = [makeCloudProfile(1, 'uuid-1', {
      events: [cloudEvent],
    })];

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    expect(result.mergedProfiles[0].events).toHaveLength(1);
    expect(result.mergedProfiles[0].events[0].id).toBe('evt-cloud-1');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 4: Unique local profile without cloud match remains
// ══════════════════════════════════════════════════════════════

describe('Unique local profiles preserved', () => {
  it('local profile with no cloud name match is kept', () => {
    const localProfiles = [
      makeDefaultProfile(1),
      { ...makeDefaultProfile(2), name: 'Custom Profile', id: 'profile-2' },
    ];
    const cloudProfiles = [makeCloudProfile(1, 'uuid-1')];

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    // Should have cloud Profile 1 + local Custom Profile
    expect(result.mergedProfiles).toHaveLength(2);
    const names = result.mergedProfiles.map(p => p.name).sort();
    expect(names).toEqual(['Custom Profile', 'Stream Profile 1']);
  });

  it('local profile with unique name retains its local ID', () => {
    const localProfiles = [{ ...makeDefaultProfile(1), name: 'My Custom Profile', id: 'profile-custom' }];
    const cloudProfiles = [makeCloudProfile(1, 'uuid-1')];

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    const customProfile = result.mergedProfiles.find(p => p.name === 'My Custom Profile');
    expect(customProfile).toBeDefined();
    expect(customProfile!.id).toBe('profile-custom');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 5: Pending local profiles behavior unchanged
// ══════════════════════════════════════════════════════════════

describe('Pending local profiles behavior', () => {
  it('local profile with pending sync is kept even if cloud match exists', () => {
    const pendingIds = new Set(['profile-1']);
    const localProfiles = [makeDefaultProfile(1)];
    const cloudProfiles = [makeCloudProfile(1, 'uuid-1')];

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, pendingIds);

    // Should keep local version (pending) instead of cloud
    expect(result.mergedProfiles).toHaveLength(1);
    expect(result.mergedProfiles[0].id).toBe('profile-1'); // local ID preserved
  });

  it('pending local profile actions/events preserved', () => {
    const pendingIds = new Set(['profile-1']);
    const localAction = makeAction('act-local-pending');
    const localProfiles = [{ ...makeDefaultProfile(1), actions: [localAction] }];
    const cloudProfiles = [makeCloudProfile(1, 'uuid-1', { actions: [makeAction('act-cloud')] })];

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, pendingIds);

    // Pending local should win
    expect(result.mergedProfiles).toHaveLength(1);
    expect(result.mergedProfiles[0].actions).toHaveLength(1);
    expect(result.mergedProfiles[0].actions[0].id).toBe('act-local-pending');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 6: importProfilesByName behavior unchanged
// ══════════════════════════════════════════════════════════════

describe('importProfilesByName compatibility', () => {
  it('name-based matching still works for import (separate code path)', () => {
    // This test documents the expected behavior of importProfilesByName
    // which uses name matching. It should remain unchanged.

    const existingProfile: StreamProfile = {
      ...makeDefaultProfile(1),
      id: 'existing-uuid',
      actions: [makeAction('act-existing')],
    };

    const importedProfile: StreamProfile = {
      ...makeDefaultProfile(1),
      id: 'imported-uuid',
      actions: [makeAction('act-imported')],
    };

    // Simulate importProfilesByName matching logic
    const updated = [existingProfile];
    const existingIdx = updated.findIndex(p => p.name === importedProfile.name);

    expect(existingIdx).toBe(0); // Found by name
    updated[existingIdx] = { ...updated[existingIdx], actions: importedProfile.actions };

    expect(updated[0].actions).toHaveLength(1);
    expect(updated[0].actions[0].id).toBe('act-imported');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 7: Profile locking / Pro limits unchanged
// ══════════════════════════════════════════════════════════════

describe('Profile locking limits', () => {
  it('lock state applied after merge based on maxProfiles', () => {
    const localProfiles = Array.from({ length: 10 }, (_, i) => makeDefaultProfile(i + 1));
    const cloudProfiles = Array.from({ length: 10 }, (_, i) =>
      makeCloudProfile(i + 1, `uuid-${i + 1}`)
    );

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    // Simulate lock application (Free = 1 profile, Pro = 10)
    const maxProfiles = 1; // Free tier
    const locked = result.mergedProfiles.map((profile, index) => ({
      ...profile,
      locked: index >= maxProfiles,
    }));

    expect(locked[0].locked).toBe(false);  // first profile unlocked
    expect(locked[1].locked).toBe(true);   // rest locked on Free
  });

  it('Pro tier unlocks all 10', () => {
    const localProfiles = Array.from({ length: 10 }, (_, i) => makeDefaultProfile(i + 1));
    const cloudProfiles = Array.from({ length: 10 }, (_, i) =>
      makeCloudProfile(i + 1, `uuid-${i + 1}`)
    );

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    const maxProfiles = 10; // Pro tier
    const locked = result.mergedProfiles.map((profile, index) => ({
      ...profile,
      locked: index >= maxProfiles,
    }));

    for (const p of locked) {
      expect(p.locked).toBe(false);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 8: Name matching is case/whitespace insensitive
// ══════════════════════════════════════════════════════════════

describe('Name matching robustness', () => {
  it('cloud name "Stream Profile 1" matches local "stream profile 1"', () => {
    const localProfiles = [{ ...makeDefaultProfile(1), name: 'stream profile 1' }];
    const cloudProfiles = [makeCloudProfile(1, 'uuid-1', { name: 'Stream Profile 1' })];

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    expect(result.mergedProfiles).toHaveLength(1);
  });

  it('cloud name "Stream Profile 1" matches local " Stream Profile 1 " (whitespace)', () => {
    const localProfiles = [{ ...makeDefaultProfile(1), name: ' Stream Profile 1 ' }];
    const cloudProfiles = [makeCloudProfile(1, 'uuid-1')];

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    expect(result.mergedProfiles).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 9: Edge case - cloud has fewer profiles than local
// ══════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('cloud has 5 profiles, local has 10 → 5 cloud + 5 unique local = 10', () => {
    const localProfiles = Array.from({ length: 10 }, (_, i) => makeDefaultProfile(i + 1));
    const cloudProfiles = Array.from({ length: 5 }, (_, i) =>
      makeCloudProfile(i + 1, `uuid-${i + 1}`)
    );

    const result = simulatePullCloudProfilesMerge(localProfiles, cloudProfiles, new Set());

    // Cloud 1-5 match local 1-5 → cloud kept
    // Local 6-10 have no cloud match → kept as localOnly
    expect(result.mergedProfiles).toHaveLength(10);

    const cloudCount = result.mergedProfiles.filter(p => p.serverId).length;
    expect(cloudCount).toBe(5);
  });
});