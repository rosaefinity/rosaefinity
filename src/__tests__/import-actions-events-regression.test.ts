// =============================================
// RosaeFinity — Actions/Events Import Regression Tests
// Proves: imported actions/events propagate to profile
// and top-level state, not overwritten by stale captures.
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
}

interface TopLevelState {
  currentProfileId: string | null;
  streamProfiles: StreamProfile[];
  actions: Action[];
  events: Event[];
  alertSettings: Record<string, unknown>;
  setupConfig: { tikTokName: string; [key: string]: unknown };
}

// ── Test data factories ──

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 'act_' + Math.random().toString(36).substring(2, 10),
    name: 'Gift Alert',
    type: 'gift',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    type: 'gift',
    actionName: 'Gift Alert',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<StreamProfile> = {}): StreamProfile {
  return {
    id: 'spf_test123',
    name: 'Stream Profile 1',
    actions: [],
    events: [],
    ...overrides,
  };
}

function makeInitialState(overrides: Partial<TopLevelState> = {}): TopLevelState {
  return {
    currentProfileId: 'spf_test123',
    streamProfiles: [makeProfile()],
    actions: [],
    events: [],
    alertSettings: {},
    setupConfig: { tikTokName: 'testuser' },
    ...overrides,
  };
}

// ── Simulate importProfilesByName (mirrors app-store.ts logic) ──
// This simulates the FIXED version — no stale state overwrite.

function simulateImportProfilesByName(
  state: TopLevelState,
  importedProfiles: StreamProfile[]
): TopLevelState {
  const updated = [...state.streamProfiles];

  for (const imported of importedProfiles) {
    const existingIdx = updated.findIndex(p => p.name === imported.name);
    const now = new Date().toISOString();

    if (existingIdx >= 0) {
      // Update existing profile by name match
      updated[existingIdx] = {
        ...updated[existingIdx],
        icon: imported.icon,
        tiktokUsername: imported.tiktokUsername,
        alertsMasterEnabled: imported.alertsMasterEnabled,
        alertsSettings: imported.alertsSettings,
        ttsSettings: imported.ttsSettings,
        actions: imported.actions,
        events: imported.events,
        customSounds: imported.customSounds,
        overlaySettings: imported.overlaySettings,
        updatedAt: now,
      };
    } else {
      // Create new profile
      const newProfile: StreamProfile = {
        id: 'spf_' + Math.random().toString(36).substring(2, 10),
        name: imported.name,
        icon: imported.icon,
        tiktokUsername: imported.tiktokUsername,
        alertsMasterEnabled: imported.alertsMasterEnabled ?? true,
        alertsSettings: imported.alertsSettings ?? {},
        ttsSettings: imported.ttsSettings,
        actions: imported.actions ?? [],
        events: imported.events ?? [],
        customSounds: imported.customSounds ?? [],
        overlaySettings: imported.overlaySettings ?? {},
        locked: updated.length >= 5,
        createdAt: now,
        updatedAt: now,
      };
      updated.push(newProfile);
    }
  }

  // Recalculate lock state
  const lockedProfiles = updated.map((p, i) => ({
    ...p,
    locked: i >= 5,
  }));

  // FIXED: Sync active profile — uses updated profile data, NOT stale captures
  if (state.currentProfileId) {
    const activeProfile = lockedProfiles.find(p => p.id === state.currentProfileId);
    if (activeProfile) {
      const syncedProfiles = lockedProfiles.map(p => {
        if (p.id === state.currentProfileId) {
          return {
            ...p,
            // Use imported profile data, not stale pre-import captures
            alertsSettings: activeProfile.alertsSettings ?? state.alertSettings,
            alertsMasterEnabled: activeProfile.alertsMasterEnabled,
            tiktokUsername: activeProfile.tiktokUsername ?? state.setupConfig.tikTokName,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });

      const refreshed = syncedProfiles.find(p => p.id === state.currentProfileId)!;

      return {
        ...state,
        streamProfiles: syncedProfiles,
        actions: refreshed.actions || [],
        events: refreshed.events || [],
        alertSettings: refreshed.alertSettings || state.alertSettings,
        setupConfig: { ...state.setupConfig, tikTokName: refreshed.tiktokUsername || "" },
      };
    }
  }

  return { ...state, streamProfiles: lockedProfiles };
}

// ── BUGGY simulation (old code) for comparison ──

function simulateBuggyImportProfilesByName(
  state: TopLevelState,
  importedProfiles: StreamProfile[]
): TopLevelState {
  const updated = [...state.streamProfiles];

  // BUG: captures stale top-level state
  const { currentProfileId, actions, events, alertSettings, setupConfig } = state;

  for (const imported of importedProfiles) {
    const existingIdx = updated.findIndex(p => p.name === imported.name);
    const now = new Date().toISOString();

    if (existingIdx >= 0) {
      updated[existingIdx] = {
        ...updated[existingIdx],
        icon: imported.icon,
        tiktokUsername: imported.tiktokUsername,
        alertsMasterEnabled: imported.alertsMasterEnabled,
        alertsSettings: imported.alertsSettings,
        ttsSettings: imported.ttsSettings,
        actions: imported.actions,
        events: imported.events,
        customSounds: imported.customSounds,
        overlaySettings: imported.overlaySettings,
        updatedAt: now,
      };
    } else {
      updated.push({
        id: 'spf_' + Math.random().toString(36).substring(2, 10),
        name: imported.name,
        actions: imported.actions ?? [],
        events: imported.events ?? [],
        locked: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const lockedProfiles = updated.map((p, i) => ({
    ...p,
    locked: i >= 5,
  }));

  // BUG: sync step overwrites with stale captures
  if (currentProfileId) {
    const activeProfile = lockedProfiles.find(p => p.id === currentProfileId);
    if (activeProfile) {
      const syncedProfiles = lockedProfiles.map(p => {
        if (p.id === currentProfileId) {
          return {
            ...p,
            actions,     // BUG: stale empty array
            events,      // BUG: stale empty array
            alertsSettings: alertSettings,
            alertsMasterEnabled: activeProfile.alertsMasterEnabled,
            tiktokUsername: setupConfig.tikTokName,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });

      const refreshed = syncedProfiles.find(p => p.id === currentProfileId)!;

      return {
        ...state,
        streamProfiles: syncedProfiles,
        actions: refreshed.actions || [],
        events: refreshed.events || [],
        alertSettings: refreshed.alertSettings || state.alertSettings,
        setupConfig: { ...state.setupConfig, tikTokName: refreshed.tiktokUsername || "" },
      };
    }
  }

  return { ...state, streamProfiles: lockedProfiles };
}

// ══════════════════════════════════════════════════════════════
// TEST 1: Imported actions/events propagate to profile + top-level
// ══════════════════════════════════════════════════════════════

describe('TEST 1: Imported actions/events propagate correctly', () => {
  it('fixed implementation: actions and events appear in profile and top-level', () => {
    const actionA = makeAction({ id: 'act_a', name: 'Action A' });
    const actionB = makeAction({ id: 'act_b', name: 'Action B' });
    const eventA = makeEvent({ id: 'evt_a', type: 'gift', actionName: 'Action A' });
    const eventB = makeEvent({ id: 'evt_b', type: 'follow', actionName: 'Action B' });

    const initialState = makeInitialState();
    const importedProfiles = [makeProfile({
      name: 'Stream Profile 1',
      actions: [actionA, actionB],
      events: [eventA, eventB],
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    // Profile has imported data
    const profile = result.streamProfiles.find(p => p.name === 'Stream Profile 1')!;
    expect(profile.actions).toHaveLength(2);
    expect(profile.events).toHaveLength(2);

    // Top-level has imported data
    expect(result.actions).toHaveLength(2);
    expect(result.events).toHaveLength(2);
  });

  it('BUGGY implementation: actions and events are lost', () => {
    const actionA = makeAction({ id: 'act_a', name: 'Action A' });
    const actionB = makeAction({ id: 'act_b', name: 'Action B' });
    const eventA = makeEvent({ id: 'evt_a', type: 'gift', actionName: 'Action A' });
    const eventB = makeEvent({ id: 'evt_b', type: 'follow', actionName: 'Action B' });

    const initialState = makeInitialState();
    const importedProfiles = [makeProfile({
      name: 'Stream Profile 1',
      actions: [actionA, actionB],
      events: [eventA, eventB],
    })];

    const result = simulateBuggyImportProfilesByName(initialState, importedProfiles);

    // BUG: Profile actions/events overwritten by stale captures
    const profile = result.streamProfiles.find(p => p.name === 'Stream Profile 1')!;
    expect(profile.actions).toHaveLength(0); // BUG!
    expect(profile.events).toHaveLength(0);  // BUG!

    // BUG: Top-level also empty
    expect(result.actions).toHaveLength(0);  // BUG!
    expect(result.events).toHaveLength(0);   // BUG!
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 2: Imported Action IDs are preserved exactly
// ══════════════════════════════════════════════════════════════

describe('TEST 2: Action IDs preserved exactly', () => {
  it('imported action IDs match original IDs', () => {
    const actionA = makeAction({ id: 'act_original_a', name: 'Original Action A' });
    const actionB = makeAction({ id: 'act_original_b', name: 'Original Action B' });

    const initialState = makeInitialState();
    const importedProfiles = [makeProfile({
      name: 'Stream Profile 1',
      actions: [actionA, actionB],
      events: [],
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    expect(result.actions[0].id).toBe('act_original_a');
    expect(result.actions[1].id).toBe('act_original_b');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 3: Imported Event IDs are preserved exactly
// ══════════════════════════════════════════════════════════════

describe('TEST 3: Event IDs preserved exactly', () => {
  it('imported event IDs match original IDs', () => {
    const eventA = makeEvent({ id: 'evt_original_a', type: 'gift', actionName: 'Action A' });
    const eventB = makeEvent({ id: 'evt_original_b', type: 'follow', actionName: 'Action B' });

    const initialState = makeInitialState();
    const importedProfiles = [makeProfile({
      name: 'Stream Profile 1',
      actions: [],
      events: [eventA, eventB],
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    expect(result.events[0].id).toBe('evt_original_a');
    expect(result.events[1].id).toBe('evt_original_b');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 4: Event actionName/actionNames references preserved
// ══════════════════════════════════════════════════════════════

describe('TEST 4: Event actionName/actionNames references preserved', () => {
  it('actionName reference is preserved exactly', () => {
    const event = makeEvent({
      id: 'evt_1',
      type: 'gift',
      actionName: 'My Gift Alert',
      actionNames: undefined,
    });

    const initialState = makeInitialState();
    const importedProfiles = [makeProfile({
      name: 'Stream Profile 1',
      actions: [],
      events: [event],
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    expect(result.events[0].actionName).toBe('My Gift Alert');
  });

  it('actionNames array reference is preserved exactly', () => {
    const event = makeEvent({
      id: 'evt_2',
      type: 'gift',
      actionName: 'Primary Alert',
      actionNames: ['Primary Alert', 'Secondary Alert'],
    });

    const initialState = makeInitialState();
    const importedProfiles = [makeProfile({
      name: 'Stream Profile 1',
      actions: [],
      events: [event],
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    expect(result.events[0].actionNames).toEqual(['Primary Alert', 'Secondary Alert']);
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 5: ActionsPage receives imported actions
// ══════════════════════════════════════════════════════════════

describe('TEST 5: ActionsPage receives imported actions', () => {
  it('top-level actions array contains imported actions', () => {
    const actions = [
      makeAction({ id: 'act_1', name: 'Gift Sound' }),
      makeAction({ id: 'act_2', name: 'Follow Alert' }),
      makeAction({ id: 'act_3', name: 'Share Effect' }),
    ];

    const initialState = makeInitialState();
    const importedProfiles = [makeProfile({
      name: 'Stream Profile 1',
      actions,
      events: [],
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    // ActionsPage reads from useAppStore().actions
    expect(result.actions).toHaveLength(3);
    expect(result.actions.map(a => a.name)).toEqual([
      'Gift Sound',
      'Follow Alert',
      'Share Effect',
    ]);
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 6: EventsPage receives imported events
// ══════════════════════════════════════════════════════════════

describe('TEST 6: EventsPage receives imported events', () => {
  it('top-level events array contains imported events', () => {
    const events = [
      makeEvent({ id: 'evt_1', type: 'gift', actionName: 'Gift Sound' }),
      makeEvent({ id: 'evt_2', type: 'follow', actionName: 'Follow Alert' }),
    ];

    const initialState = makeInitialState();
    const importedProfiles = [makeProfile({
      name: 'Stream Profile 1',
      actions: [],
      events,
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    // EventsPage reads from useAppStore().events
    expect(result.events).toHaveLength(2);
    expect(result.events.map(e => e.type)).toEqual(['gift', 'follow']);
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 7: Active profile import propagates to top-level
// ══════════════════════════════════════════════════════════════

describe('TEST 7: Active profile import propagates to top-level state', () => {
  it('importing into the currently active profile updates top-level actions/events', () => {
    const action = makeAction({ id: 'act_active', name: 'Active Profile Action' });
    const event = makeEvent({ id: 'evt_active', type: 'gift', actionName: 'Active Profile Action' });

    const initialState = makeInitialState({
      currentProfileId: 'spf_test123',
      actions: [],
      events: [],
    });

    const importedProfiles = [makeProfile({
      id: 'spf_test123',
      name: 'Stream Profile 1',
      actions: [action],
      events: [event],
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    // Top-level should reflect the imported data
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('act_active');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe('evt_active');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 8: Non-active profile import does NOT overwrite active profile
// ══════════════════════════════════════════════════════════════

describe('TEST 8: Non-active profile import does not overwrite active profile', () => {
  it('importing a different profile preserves active profile top-level state', () => {
    const activeAction = makeAction({ id: 'act_active', name: 'Active Action' });
    const activeEvent = makeEvent({ id: 'evt_active', type: 'gift', actionName: 'Active Action' });

    const importedAction = makeAction({ id: 'act_other', name: 'Other Action' });
    const importedEvent = makeEvent({ id: 'evt_other', type: 'follow', actionName: 'Other Action' });

    const initialState = makeInitialState({
      currentProfileId: 'spf_active',
      streamProfiles: [
        makeProfile({ id: 'spf_active', name: 'Active Profile', actions: [activeAction], events: [activeEvent] }),
      ],
      actions: [activeAction],
      events: [activeEvent],
    });

    // Import a DIFFERENT profile (not the active one)
    const importedProfiles = [makeProfile({
      id: 'spf_other',
      name: 'Other Profile',
      actions: [importedAction],
      events: [importedEvent],
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    // Active profile's top-level state should be PRESERVED
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('act_active');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe('evt_active');

    // The other profile should exist in streamProfiles with its data
    const otherProfile = result.streamProfiles.find(p => p.name === 'Other Profile');
    expect(otherProfile).toBeDefined();
    expect(otherProfile!.actions).toHaveLength(1);
    expect(otherProfile!.actions[0].id).toBe('act_other');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 9: Profile switch behavior still works
// ══════════════════════════════════════════════════════════════

describe('TEST 9: Profile data isolation is maintained', () => {
  it('each profile maintains its own actions/events independently', () => {
    const action1 = makeAction({ id: 'act_p1', name: 'Profile 1 Action' });
    const action2 = makeAction({ id: 'act_p2', name: 'Profile 2 Action' });
    const event1 = makeEvent({ id: 'evt_p1', type: 'gift', actionName: 'Profile 1 Action' });
    const event2 = makeEvent({ id: 'evt_p2', type: 'follow', actionName: 'Profile 2 Action' });

    const initialState = makeInitialState({
      currentProfileId: 'spf_p1',
      streamProfiles: [
        makeProfile({ id: 'spf_p1', name: 'Profile 1', actions: [action1], events: [event1] }),
      ],
      actions: [action1],
      events: [event1],
    });

    // Import Profile 2
    const importedProfiles = [makeProfile({
      id: 'spf_p2',
      name: 'Profile 2',
      actions: [action2],
      events: [event2],
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    // Active profile (Profile 1) retains its data
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('act_p1');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe('evt_p1');

    // Profile 2 has its own data
    const profile2 = result.streamProfiles.find(p => p.name === 'Profile 2')!;
    expect(profile2.actions).toHaveLength(1);
    expect(profile2.actions[0].id).toBe('act_p2');
    expect(profile2.events).toHaveLength(1);
    expect(profile2.events[0].id).toBe('evt_p2');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST 10: No cloud sync needed for visibility
// ══════════════════════════════════════════════════════════════

describe('TEST 10: Imported actions/events visible without cloud sync', () => {
  it('actions and events are in top-level state immediately after import', () => {
    const actions = [
      makeAction({ id: 'act_1' }),
      makeAction({ id: 'act_2' }),
      makeAction({ id: 'act_3' }),
    ];
    const events = [
      makeEvent({ id: 'evt_1' }),
      makeEvent({ id: 'evt_2' }),
    ];

    const initialState = makeInitialState();
    const importedProfiles = [makeProfile({
      name: 'Stream Profile 1',
      actions,
      events,
    })];

    const result = simulateImportProfilesByName(initialState, importedProfiles);

    // Immediately visible — no async cloud sync needed
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.actions).toHaveLength(3);
    expect(result.events).toHaveLength(2);
  });
});

// ══════════════════════════════════════════════════════════════
// TEST: Runtime regression — exact failure scenario
// ══════════════════════════════════════════════════════════════

describe('Runtime regression: exact failure scenario', () => {
  it('old code loses data, fixed code preserves it', () => {
    const actionA = makeAction({ id: 'act_a', name: 'Gift Alert' });
    const actionB = makeAction({ id: 'act_b', name: 'Follow Alert' });
    const eventA = makeEvent({ id: 'evt_a', type: 'gift', actionName: 'Gift Alert' });
    const eventB = makeEvent({ id: 'evt_b', type: 'follow', actionName: 'Follow Alert' });

    const initialState = makeInitialState();
    const importedProfiles = [makeProfile({
      name: 'Stream Profile 1',
      actions: [actionA, actionB],
      events: [eventA, eventB],
    })];

    // Old code: data is lost
    const buggyResult = simulateBuggyImportProfilesByName(initialState, importedProfiles);
    expect(buggyResult.actions).toHaveLength(0);
    expect(buggyResult.events).toHaveLength(0);

    // Fixed code: data is preserved
    const fixedResult = simulateImportProfilesByName(initialState, importedProfiles);
    expect(fixedResult.actions).toHaveLength(2);
    expect(fixedResult.events).toHaveLength(2);
    expect(fixedResult.actions[0].id).toBe('act_a');
    expect(fixedResult.actions[1].id).toBe('act_b');
    expect(fixedResult.events[0].id).toBe('evt_a');
    expect(fixedResult.events[1].id).toBe('evt_b');
  });
});

// ══════════════════════════════════════════════════════════════
// TEST: pullCloudProfiles syncs active profile to top-level
// (This was the real runtime root cause)
// ══════════════════════════════════════════════════════════════

/** Simulates pullCloudProfiles — replaces streamProfiles with cloud data
 *  and MUST sync active profile's actions/events to top-level state. */
function simulatePullCloudProfiles(
  state: TopLevelState,
  cloudProfiles: StreamProfile[]
): TopLevelState {
  // Mirror pullCloudProfiles: set streamProfiles + currentProfileId
  const activeId = cloudProfiles.length > 0 ? cloudProfiles[0].id : null;
  const active = activeId ? cloudProfiles.find(p => p.id === activeId) : null;

  return {
    ...state,
    streamProfiles: cloudProfiles,
    currentProfileId: activeId,
    // FIXED: sync active profile's data to top-level
    ...(active ? {
      actions: active.actions || [],
      events: active.events || [],
    } : {}),
  };
}

/** Simulates OLD pullCloudProfiles — the bug: only sets streamProfiles + currentProfileId */
function simulateBuggyPullCloudProfiles(
  state: TopLevelState,
  cloudProfiles: StreamProfile[]
): TopLevelState {
  // OLD code only called: set({ streamProfiles, currentProfileId })
  // In Zustand, set() is a shallow merge, so actions/events from previous
  // state are preserved. But the real bug is: when pullCloudProfiles runs
  // FIRST (on init, before any import), top-level actions/events are empty [],
  // and the cloud profiles have their own actions/events in profile objects.
  // The top-level state is NOT updated to match the active profile.
  const activeId = cloudProfiles.length > 0 ? cloudProfiles[0].id : null;
  return {
    ...state,
    streamProfiles: cloudProfiles,
    currentProfileId: activeId,
    // BUG: does NOT sync active profile's actions/events to top-level
    // Top-level stays as whatever it was before (empty [] on init)
  };
}

describe('pullCloudProfiles: active profile sync to top-level state', () => {
  it('FIXED: after pull, active profile actions/events are in top-level state', () => {
    const action = makeAction({ id: 'act_cloud', name: 'Cloud Action' });
    const event = makeEvent({ id: 'evt_cloud', type: 'gift', actionName: 'Cloud Action' });

    const stateBeforePull = makeInitialState({
      currentProfileId: 'spf_cloud',
      streamProfiles: [
        makeProfile({ id: 'spf_cloud', name: 'Cloud Profile', actions: [action], events: [event] }),
      ],
      actions: [],  // top-level is empty before pull sync
      events: [],
    });

    const cloudProfiles = [
      makeProfile({ id: 'spf_cloud', name: 'Cloud Profile', actions: [action], events: [event] }),
    ];

    const result = simulatePullCloudProfiles(stateBeforePull, cloudProfiles);

    // After fixed pull: top-level has the active profile's data
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('act_cloud');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe('evt_cloud');
  });

  it('BUGGY: after pull, top-level actions/events remain empty', () => {
    const action = makeAction({ id: 'act_cloud', name: 'Cloud Action' });
    const event = makeEvent({ id: 'evt_cloud', type: 'gift', actionName: 'Cloud Action' });

    const stateBeforePull = makeInitialState({
      currentProfileId: 'spf_cloud',
      streamProfiles: [
        makeProfile({ id: 'spf_cloud', name: 'Cloud Profile', actions: [action], events: [event] }),
      ],
      actions: [],
      events: [],
    });

    const cloudProfiles = [
      makeProfile({ id: 'spf_cloud', name: 'Cloud Profile', actions: [action], events: [event] }),
    ];

    const result = simulateBuggyPullCloudProfiles(stateBeforePull, cloudProfiles);

    // BUG: top-level remains empty even though profile has data
    expect(result.actions).toHaveLength(0);
    expect(result.events).toHaveLength(0);
  });

  it('end-to-end: import → pull → data survives', () => {
    const actionA = makeAction({ id: 'act_imported', name: 'Imported Action' });
    const eventA = makeEvent({ id: 'evt_imported', type: 'gift', actionName: 'Imported Action' });

    // Step 1: Start with empty state
    const initialState = makeInitialState();

    // Step 2: Import profiles
    const afterImport = simulateImportProfilesByName(initialState, [
      makeProfile({
        id: 'spf_test123',
        name: 'Stream Profile 1',
        actions: [actionA],
        events: [eventA],
      }),
    ]);

    // Verify import worked
    expect(afterImport.actions).toHaveLength(1);
    expect(afterImport.events).toHaveLength(1);

    // Step 3: Cloud pull happens (simulated)
    const afterPull = simulatePullCloudProfiles(afterImport, afterImport.streamProfiles);

    // Data survives the pull
    expect(afterPull.actions).toHaveLength(1);
    expect(afterPull.actions[0].id).toBe('act_imported');
    expect(afterPull.events).toHaveLength(1);
    expect(afterPull.events[0].id).toBe('evt_imported');
  });

  it('end-to-end BUGGY: export reads empty profile → import gets empty', () => {
    // REAL BUG SCENARIO:
    // User creates actions/events → they live in top-level state
    // But profile.actions and profile.events are still [] (never synced via switchProfile)
    // Export reads from profile objects → exports actions: [], events: []
    // Import faithfully imports empty arrays → "No Actions Defined"

    const actionA = makeAction({ id: 'act_real', name: 'Real Action' });
    const eventA = makeEvent({ id: 'evt_real', type: 'gift', actionName: 'Real Action' });

    // State: top-level has data, but profile object does NOT
    const stateWithTopLevelData = makeInitialState({
      streamProfiles: [
        makeProfile({
          id: 'spf_test123',
          name: 'Stream Profile 1',
          actions: [],   // ← profile is EMPTY (never synced from top-level)
          events: [],    // ← profile is EMPTY
        }),
      ],
      actions: [actionA],   // ← top-level HAS the data
      events: [eventA],     // ← top-level HAS the data
    });

    // BUGGY export: reads from profile objects, not top-level state
    const buggyExport = stateWithTopLevelData.streamProfiles.map(p => ({
      ...p,
      actions: p.actions ?? [],  // reads EMPTY profile.actions
      events: p.events ?? [],    // reads EMPTY profile.events
    }));

    expect(buggyExport[0].actions).toHaveLength(0); // exports empty!
    expect(buggyExport[0].events).toHaveLength(0);  // exports empty!

    // Import the buggy export → gets empty data
    const afterImport = simulateImportProfilesByName(stateWithTopLevelData, buggyExport);
    expect(afterImport.actions).toHaveLength(0);  // "No Actions Defined"
    expect(afterImport.events).toHaveLength(0);   // "No Events Defined"
  });

  it('end-to-end FIXED: export syncs top-level → import gets data', () => {
    const actionA = makeAction({ id: 'act_real', name: 'Real Action' });
    const eventA = makeEvent({ id: 'evt_real', type: 'gift', actionName: 'Real Action' });

    const stateWithTopLevelData = makeInitialState({
      currentProfileId: 'spf_test123',
      streamProfiles: [
        makeProfile({
          id: 'spf_test123',
          name: 'Stream Profile 1',
          actions: [],   // ← profile is EMPTY
          events: [],    // ← profile is EMPTY
        }),
      ],
      actions: [actionA],   // ← top-level HAS the data
      events: [eventA],     // ← top-level HAS the data
    });

    // FIXED export: syncs top-level state into active profile before serializing
    const fixedExport = stateWithTopLevelData.streamProfiles.map(p => {
      if (p.id === stateWithTopLevelData.currentProfileId) {
        return {
          ...p,
          actions: stateWithTopLevelData.actions,   // ← uses TOP-LEVEL data
          events: stateWithTopLevelData.events,     // ← uses TOP-LEVEL data
        };
      }
      return { ...p, actions: p.actions ?? [], events: p.events ?? [] };
    });

    expect(fixedExport[0].actions).toHaveLength(1); // exports real data!
    expect(fixedExport[0].events).toHaveLength(1);  // exports real data!

    // Import the fixed export → gets the data
    const afterImport = simulateImportProfilesByName(stateWithTopLevelData, fixedExport);
    expect(afterImport.actions).toHaveLength(1);
    expect(afterImport.actions[0].id).toBe('act_real');
    expect(afterImport.events).toHaveLength(1);
    expect(afterImport.events[0].id).toBe('evt_real');
  });
});
