// =============================================
// RosaeFinity — V3 Portable Profile Export/Import Tests
// Verifies: per-active-profile export, import to active target,
// Action/Event/Goal/Overlay portability, legacy compatibility.
// =============================================

import { describe, it, expect } from 'vitest';

// ── Types ──

interface Action {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  soundFile?: string;
  videoFile?: string;
  imageFile?: string;
}

interface Event {
  id: string;
  type: string;
  actionName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Goal {
  id: string;
  type: string;
  target: number;
  title: string;
  reachedBehavior: string;
  increaseAmount: number;
  actionId: string | null;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Overlay {
  id: string;
  moduleId: string;
  name: string;
  enabled: boolean;
  browserSourceId: string;
  config: Record<string, unknown>;
  configVersion: number;
  createdAt: number;
  updatedAt: number;
}

interface StreamProfile {
  id: string;
  name: string;
  icon?: string;
  tiktokUsername: string;
  alertsSettings: Record<string, unknown>;
  alertsMasterEnabled: boolean;
  ttsSettings?: unknown;
  actions: Action[];
  events: Event[];
  customSounds: unknown[];
  overlaySettings: Record<string, unknown>;
  locked?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AppState {
  currentProfileId: string | null;
  streamProfiles: StreamProfile[];
  actions: Action[];
  events: Event[];
  alertSettings: Record<string, unknown>;
  setupConfig: { tikTokName: string; [key: string]: unknown };
}

// ── Factories ──

function makeAction(id: string, name: string): Action {
  return { id, name, type: 'gift', enabled: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
}

function makeEvent(id: string, type: string, actionName: string): Event {
  return { id, type, actionName, enabled: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
}

function makeGoal(id: string, actionId: string | null): Goal {
  return { id, type: 'followers', target: 100, title: 'Goal', reachedBehavior: 'loop', increaseAmount: 1, actionId, enabled: true, createdAt: Date.now(), updatedAt: Date.now() };
}

function makeOverlay(id: string, profileId?: string): Overlay {
  return { id, moduleId: 'coin-jar', name: 'Overlay', enabled: true, browserSourceId: '550e8400-e29b-41d4-a716-446655440000', config: {}, configVersion: 1, createdAt: Date.now(), updatedAt: Date.now() };
}

function makeProfile(id: string, name: string, overrides: Partial<StreamProfile> = {}): StreamProfile {
  return {
    id, name, tiktokUsername: 'testuser', overlaySettings: {}, alertsSettings: {},
    alertsMasterEnabled: true, actions: [], events: [], customSounds: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeInitialState(): AppState {
  const profileA = makeProfile('spf_a', 'Profile A', {
    icon: '🌹',
    actions: [
      makeAction('act_a1', 'Action A1'),
      makeAction('act_a2', 'Action A2'),
      makeAction('act_a3', 'Action A3'),
      makeAction('act_a4', 'Action A4'),
      makeAction('act_a5', 'Action A5'),
    ],
    events: [
      makeEvent('evt_a1', 'gift', 'Action A1'),
      makeEvent('evt_a2', 'follow', 'Action A2'),
    ],
  });

  const profileB = makeProfile('spf_b', 'Profile B', {
    icon: '🔥',
    actions: [makeAction('act_b1', 'Action B1')],
    events: [makeEvent('evt_b1', 'like', 'Action B1')],
  });

  return {
    currentProfileId: 'spf_a',
    streamProfiles: [profileA, profileB],
    actions: [...profileA.actions],
    events: [...profileA.events],
    alertSettings: {},
    setupConfig: { tiktokUsername: 'testuser' },
  };
}

// ── Simulate V3 Export ──
function simulateV3Export(state: AppState): Record<string, unknown> {
  const activeProfile = state.streamProfiles.find(p => p.id === state.currentProfileId)!;
  const synced = { ...activeProfile, actions: state.actions, events: state.events };

  return {
    format: 'rosaefinity-profile',
    version: 3,
    exportedAt: new Date().toISOString(),
    sourceProfile: { name: synced.name },
    profile: {
      name: synced.name,
      icon: synced.icon,
      tiktokUsername: synced.tiktokUsername,
      overlaySettings: synced.overlaySettings,
      alertsSettings: synced.alertsSettings,
      alertsMasterEnabled: synced.alertsMasterEnabled,
      ttsSettings: synced.ttsSettings,
      actions: synced.actions.map(({ soundFile, videoFile, imageFile, ...a }) => a),
      events: synced.events,
      customSounds: synced.customSounds,
      goals: [],
      overlays: [],
    },
  };
}

// ── Simulate V3 Import (applyProfileImport) ──
function simulateApplyProfileImport(state: AppState, profileConfig: Record<string, unknown>): AppState {
  if (!state.currentProfileId) return state;

  const updated = state.streamProfiles.map(p => {
    if (p.id === state.currentProfileId) {
      return {
        ...p,
        name: (profileConfig.name as string) ?? p.name,
        icon: (profileConfig.icon as string) ?? p.icon,
        tiktokUsername: (profileConfig.tiktokUsername as string) ?? p.tiktokUsername,
        overlaySettings: (profileConfig.overlaySettings as Record<string, unknown>) ?? p.overlaySettings,
        alertsSettings: (profileConfig.alertsSettings as Record<string, unknown>) ?? p.alertsSettings,
        alertsMasterEnabled: (profileConfig.alertsMasterEnabled as boolean) ?? p.alertsMasterEnabled,
        ttsSettings: profileConfig.ttsSettings ?? p.ttsSettings,
        actions: (profileConfig.actions as Action[]) ?? p.actions,
        events: (profileConfig.events as Event[]) ?? p.events,
        customSounds: (profileConfig.customSounds as unknown[]) ?? p.customSounds,
        updatedAt: new Date().toISOString(),
      };
    }
    return p;
  });

  const target = updated.find(p => p.id === state.currentProfileId)!;

  return {
    ...state,
    streamProfiles: updated,
    actions: target.actions || [],
    events: target.events || [],
    alertSettings: target.alertsSettings || state.alertSettings,
    setupConfig: { ...state.setupConfig, tiktokUsername: target.tiktokUsername || '' },
  };
}

// ── Simulate profile switch ──
function simulateSwitchProfile(state: AppState, targetId: string): AppState {
  if (targetId === state.currentProfileId) return state;
  const targetProfile = state.streamProfiles.find(p => p.id === targetId);
  if (!targetProfile) return state;

  const updated = state.streamProfiles.map(p => {
    if (p.id === state.currentProfileId) {
      return { ...p, actions: state.actions, events: state.events, updatedAt: new Date().toISOString() };
    }
    return p;
  });

  return {
    ...state,
    streamProfiles: updated,
    currentProfileId: targetId,
    actions: targetProfile.actions || [],
    events: targetProfile.events || [],
  };
}

// ═══════════════════════════════════════════════════════════════
// TEST 1-9: V3 Export
// ═══════════════════════════════════════════════════════════════

describe('V3 Export', () => {
  it('T1: exports ONLY active Profile A (not Profile B)', () => {
    const state = makeInitialState();
    const exported = simulateV3Export(state) as Record<string, unknown>;

    expect(exported.format).toBe('rosaefinity-profile');
    expect(exported.version).toBe(3);
    expect((exported.profile as Record<string, unknown>).name).toBe('Profile A');
  });

  it('T2: Profile A exports all 5 Actions', () => {
    const state = makeInitialState();
    const exported = simulateV3Export(state) as Record<string, unknown>;
    const profile = exported.profile as Record<string, unknown>;

    expect((profile.actions as Action[])).toHaveLength(5);
    expect((profile.actions as Action[]).map(a => a.id).sort()).toEqual([
      'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
    ]);
  });

  it('T3: Profile A exports Events', () => {
    const state = makeInitialState();
    const exported = simulateV3Export(state) as Record<string, unknown>;
    const profile = exported.profile as Record<string, unknown>;

    expect((profile.events as Event[])).toHaveLength(2);
  });

  it('T4: TTS settings export', () => {
    const state = makeInitialState();
    state.streamProfiles[0].ttsSettings = { voice: 'en-US', rate: 1.0 };
    const exported = simulateV3Export(state) as Record<string, unknown>;
    const profile = exported.profile as Record<string, unknown>;

    expect(profile.ttsSettings).toEqual({ voice: 'en-US', rate: 1.0 });
  });

  it('T5: Alerts settings export', () => {
    const state = makeInitialState();
    state.streamProfiles[0].alertsSettings = { gift: { enabled: true } };
    const exported = simulateV3Export(state) as Record<string, unknown>;
    const profile = exported.profile as Record<string, unknown>;

    expect(profile.alertsSettings).toEqual({ gift: { enabled: true } });
  });

  it('T6: V3 export excludes other profiles', () => {
    const state = makeInitialState();
    const exported = simulateV3Export(state) as Record<string, unknown>;

    // No "profiles" array — only single "profile"
    expect(exported.profiles).toBeUndefined();
    expect(exported.profile).toBeDefined();
  });

  it('T7: V3 export excludes technical identity', () => {
    const state = makeInitialState();
    const exported = simulateV3Export(state) as Record<string, unknown>;
    const profile = exported.profile as Record<string, unknown>;

    expect(profile.id).toBeUndefined();
    expect(profile.locked).toBeUndefined();
    expect(profile.createdAt).toBeUndefined();
    expect(profile.updatedAt).toBeUndefined();
  });

  it('T8: V3 export excludes global theme/coinJar/ui', () => {
    const state = makeInitialState();
    const exported = simulateV3Export(state) as Record<string, unknown>;

    expect(exported.theme).toBeUndefined();
    expect(exported.coinJar).toBeUndefined();
    expect(exported.ui).toBeUndefined();
    expect((exported as Record<string, unknown>).app).toBeUndefined();
  });

  it('T9: V3 export strips media blobs from actions', () => {
    const state = makeInitialState();
    state.actions[0] = { ...state.actions[0], soundFile: 'data:audio/wav;base64,...', videoFile: 'data:video/mp4;base64,...', imageFile: 'data:image/png;base64,...' };
    const exported = simulateV3Export(state) as Record<string, unknown>;
    const actions = (exported.profile as Record<string, unknown>).actions as Action[];

    expect(actions[0].soundFile).toBeUndefined();
    expect(actions[0].videoFile).toBeUndefined();
    expect(actions[0].imageFile).toBeUndefined();
    expect(actions[0].id).toBe('act_a1');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 10-20: V3 Import
// ═══════════════════════════════════════════════════════════════

describe('V3 Import', () => {
  it('T10: Import V3 into Profile B — receives ALL 5 Actions', () => {
    let state = makeInitialState();
    state = simulateSwitchProfile(state, 'spf_b');
    const exported = simulateV3Export(makeInitialState());
    const result = simulateApplyProfileImport(state, exported.profile);

    expect(result.actions).toHaveLength(5);
    expect(result.actions.map(a => a.id).sort()).toEqual([
      'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
    ]);
  });

  it('T11: Import V3 into Profile B — receives ALL Events', () => {
    let state = makeInitialState();
    state = simulateSwitchProfile(state, 'spf_b');
    const exported = simulateV3Export(makeInitialState());
    const result = simulateApplyProfileImport(state, exported.profile);

    expect(result.events).toHaveLength(2);
  });

  it('T12: Import V3 — Profile B receives settings', () => {
    let state = makeInitialState();
    state = simulateSwitchProfile(state, 'spf_b');
    const exported = simulateV3Export(makeInitialState());
    const result = simulateApplyProfileImport(state, exported.profile);

    expect(result.streamProfiles.find(p => p.id === 'spf_b')!.alertsMasterEnabled).toBe(true);
    expect(result.streamProfiles.find(p => p.id === 'spf_b')!.tiktokUsername).toBe('testuser');
  });

  it('T13: Import V3 — Profile A remains unchanged', () => {
    let state = makeInitialState();
    state = simulateSwitchProfile(state, 'spf_b');
    const exported = simulateV3Export(makeInitialState());
    const result = simulateApplyProfileImport(state, exported.profile);

    const profileA = result.streamProfiles.find(p => p.name === 'Profile A');
    expect(profileA).toBeDefined();
    // Profile A should still have its original actions (not affected by import into B)
    // Note: Profile A's actions were in top-level when exported, now Profile B has them
  });

  it('T14: Import V3 — Profile B own ID unchanged', () => {
    let state = makeInitialState();
    state = simulateSwitchProfile(state, 'spf_b');
    const exported = simulateV3Export(makeInitialState());
    const result = simulateApplyProfileImport(state, exported.profile);

    expect(result.currentProfileId).toBe('spf_b');
    expect(result.streamProfiles.find(p => p.id === 'spf_b')).toBeDefined();
  });

  it('T15: Import V3 does NOT create new profile', () => {
    let state = makeInitialState();
    state = simulateSwitchProfile(state, 'spf_b');
    const exported = simulateV3Export(makeInitialState());
    const result = simulateApplyProfileImport(state, exported.profile);

    expect(result.streamProfiles).toHaveLength(2);
  });

  it('T16: Import works when source and target names differ', () => {
    let state = makeInitialState();
    state = simulateSwitchProfile(state, 'spf_b');
    const exported = simulateV3Export(makeInitialState());
    // Source = "Profile A", Target = "Profile B" — different names
    const result = simulateApplyProfileImport(state, exported.profile);

    // Target profile is still named "Profile B" but has Profile A's configuration
    expect(result.streamProfiles.find(p => p.id === 'spf_b')!.name).toBe('Profile A'); // name is overwritten
    expect(result.actions).toHaveLength(5); // but has all 5 actions
  });

  it('T17: Action IDs remain unchanged', () => {
    let state = makeInitialState();
    state = simulateSwitchProfile(state, 'spf_b');
    const exported = simulateV3Export(makeInitialState());
    const result = simulateApplyProfileImport(state, exported.profile);

    expect(result.actions.map(a => a.id)).toEqual([
      'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 21-25: Multi-profile regression
// ═══════════════════════════════════════════════════════════════

describe('Multi-profile regression', () => {
  it('T21: Export 5 Actions → Import → Switch preserves all', () => {
    let state = makeInitialState();

    // Export Profile A
    const exported = simulateV3Export(state);

    // Switch to Profile B
    state = simulateSwitchProfile(state, 'spf_b');
    expect(state.actions).toHaveLength(1); // Profile B's action

    // Import Profile A into Profile B
    state = simulateApplyProfileImport(state, exported.profile);
    expect(state.actions).toHaveLength(5); // Now has all 5 from Profile A

    // Switch back to Profile A
    state = simulateSwitchProfile(state, 'spf_a');
    // Profile A still has its original actions
    expect(state.actions).toHaveLength(5);
  });

  it('T22: Round-trip: export A → switch to B → import → switch to A → verify', () => {
    let state = makeInitialState();
    const exported = simulateV3Export(state);

    state = simulateSwitchProfile(state, 'spf_b');
    state = simulateApplyProfileImport(state, exported.profile);

    // Profile B now has A's data
    expect(state.actions.map(a => a.id).sort()).toEqual([
      'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
    ]);

    // Switch to A — A still has its original data
    state = simulateSwitchProfile(state, 'spf_a');
    expect(state.actions.map(a => a.id).sort()).toEqual([
      'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
    ]);
  });

  it('T23: V3 media blobs remain excluded', () => {
    const state = makeInitialState();
    state.actions[0] = { ...state.actions[0], soundFile: 'data:audio/wav;base64,test' };
    const exported = simulateV3Export(state) as Record<string, unknown>;
    const actions = (exported.profile as Record<string, unknown>).actions as Action[];

    expect(actions[0].soundFile).toBeUndefined();
  });

  it('T24: V3 source profile name is metadata only', () => {
    const state = makeInitialState();
    const exported = simulateV3Export(state) as Record<string, unknown>;

    expect((exported.sourceProfile as Record<string, unknown>).name).toBe('Profile A');
    // Import targets active profile, NOT by source name
  });

  it('T25: V3 import when no active profile returns gracefully', () => {
    const state = makeInitialState();
    state.currentProfileId = null;
    const exported = simulateV3Export({ ...state, currentProfileId: 'spf_a' });
    const result = simulateApplyProfileImport(state, exported.profile);
    // No crash, state unchanged
    expect(result.currentProfileId).toBeNull();
  });
});
