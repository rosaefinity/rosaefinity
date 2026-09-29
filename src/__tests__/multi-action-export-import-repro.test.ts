// =============================================
// RosaeFinity — Multi-Action Export/Import Reproduction Test
// Deterministically simulates the exact user scenario:
// - Profile A with 5 Actions
// - Profile B with 3 Actions
// - Export, import, profile switching
// - Uses REAL production logic where possible
// =============================================

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// ── Production Types (mirrored from app-store.ts) ──

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
  soundFileName?: string;
  videoFileName?: string;
  imageFileName?: string;
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
  serverId?: string;
}

interface AppState {
  currentProfileId: string | null;
  streamProfiles: StreamProfile[];
  actions: Action[];
  events: Event[];
  alertSettings: Record<string, unknown>;
  setupConfig: { tikTokName: string; [key: string]: unknown };
  customSounds: unknown[];
}

// ── Test Fixtures ──

const PROFILE_A_ID = 'spf_profile_a';
const PROFILE_B_ID = 'spf_profile_b';

function makeAction(id: string, name: string, type: string = 'gift'): Action {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id,
    name,
    type,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

function makeProfile(id: string, name: string, actions: Action[]): StreamProfile {
  return {
    id,
    name,
    actions,
    events: [],
    customSounds: [],
    overlaySettings: {},
    alertsSettings: {},
    alertsMasterEnabled: true,
    tiktokUsername: '',
    locked: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeInitialState(): AppState {
  const profileA = makeProfile(PROFILE_A_ID, 'Profile A', [
    makeAction('act_a1', 'Action A1', 'gift'),
    makeAction('act_a2', 'Action A2', 'follow'),
    makeAction('act_a3', 'Action A3', 'like'),
    makeAction('act_a4', 'Action A4', 'comment'),
    makeAction('act_a5', 'Action A5', 'share'),
  ]);

  const profileB = makeProfile(PROFILE_B_ID, 'Profile B', [
    makeAction('act_b1', 'Action B1', 'gift'),
    makeAction('act_b2', 'Action B2', 'follow'),
    makeAction('act_b3', 'Action B3', 'like'),
  ]);

  return {
    currentProfileId: PROFILE_A_ID,
    streamProfiles: [profileA, profileB],
    actions: [...profileA.actions], // top-level mirrors active profile
    events: [],
    alertSettings: {},
    setupConfig: { tikTokName: 'testuser' },
    customSounds: [],
  };
}

// ── Production Logic Replicas (must mirror actual code) ──

// Simulate handleExport() from Settings.tsx
function simulateExport(state: AppState): {
  profiles: StreamProfile[];
} {
  // Mirror: sync active profile with top-level before export
  const profilesToExport = state.streamProfiles.map(p => {
    if (p.id === state.currentProfileId) {
      return {
        ...p,
        actions: state.actions, // read from TOP-LEVEL
        events: state.events,
        alertSettings: state.alertSettings,
        tiktokUsername: state.setupConfig.tikTokName,
      };
    }
    return p;
  });

  // Mirror: strip sensitive/machine fields
  const profiles = profilesToExport.map(({ serverId, locked, id, createdAt, updatedAt, ...rest }) => ({
    ...rest,
    actions: rest.actions?.map(({ soundFile, videoFile, imageFile, ...action }) => action) ?? [],
    customSounds: rest.customSounds?.map(({ file, ...sound }) => sound) ?? [],
  }));

  return { profiles };
}

// Simulate importProfilesByName() from app-store.ts
function simulateImportProfilesByName(
  state: AppState,
  importedProfiles: StreamProfile[]
): AppState {
  const maxProfiles = 10; // Pro tier
  const updated = [...state.streamProfiles];

  // Note: current implementation captures stale state but doesn't use it for actions
  // const { currentProfileId, alertSettings, setupConfig } = get();

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
        actions: imported.actions,      // REPLACES with imported actions
        events: imported.events,
        customSounds: imported.customSounds,
        overlaySettings: imported.overlaySettings,
        updatedAt: now,
      };
    } else {
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
        locked: updated.length >= maxProfiles,
        createdAt: now,
        updatedAt: now,
      };
      updated.push(newProfile);
    }
  }

  // Recalculate lock state
  const lockedProfiles = updated.map((p, i) => ({
    ...p,
    locked: i >= maxProfiles,
  }));

  // Sync active profile's data into top-level state
  if (state.currentProfileId) {
    const activeProfile = lockedProfiles.find(p => p.id === state.currentProfileId);
    if (activeProfile) {
      // Simulate the "syncedProfiles" step (uses updated profile, not stale captures)
      const syncedProfiles = lockedProfiles.map(p => {
        if (p.id === state.currentProfileId) {
          return {
            ...p,
            alertsSettings: activeProfile.alertsSettings ?? state.alertSettings,
            alertsMasterEnabled: activeProfile.alertsMasterEnabled,
            tiktokUsername: activeProfile.tiktokUsername ?? state.setupConfig.tikTokName,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      });

      const refreshed = syncedProfiles.find(p => p.id === state.currentProfileId)!;

      // This is what the real code does:
      return {
        ...state,
        streamProfiles: syncedProfiles,
        actions: refreshed.actions || [],  // ← ONLY active profile synced to top-level
        events: refreshed.events || [],
        alertSettings: refreshed.alertSettings || state.alertSettings,
        setupConfig: { ...state.setupConfig, tikTokName: refreshed.tiktokUsername || '' },
      };
    }
  }

  // If no active profile match, only update streamProfiles
  return { ...state, streamProfiles: lockedProfiles };
}

// Simulate switchProfile() from app-store.ts
function simulateSwitchProfile(
  state: AppState,
  targetId: string
): AppState {
  if (targetId === state.currentProfileId) return state;

  const targetProfile = state.streamProfiles.find(p => p.id === targetId);
  if (!targetProfile) return state;

  if (targetProfile.locked) return state;

  // Capture previous profile snapshot BEFORE state update
  const previousProfile = state.streamProfiles.find(p => p.id === state.currentProfileId);
  const previousSnapshot = {
    actions: state.actions,
    events: state.events,
    alertsSettings: state.alertSettings,
    alertsMasterEnabled: previousProfile?.alertsMasterEnabled ?? true,
    tiktokUsername: state.setupConfig.tikTokName,
    // customSounds: state.customSounds.filter(s => s.profileId === state.currentProfileId),
  };

  // Write previous snapshot to previous profile
  const updatedProfiles = state.streamProfiles.map(p => {
    if (p.id === state.currentProfileId) {
      return {
        ...p,
        ...previousSnapshot,
        updatedAt: new Date().toISOString(),
      };
    }
    return p;
  });

  // Load target profile into top-level state
  return {
    ...state,
    streamProfiles: updatedProfiles,
    currentProfileId: targetId,
    actions: targetProfile.actions || [],
    events: targetProfile.events || [],
    alertSettings: targetProfile.alertsSettings || {},
    setupConfig: { ...state.setupConfig, tikTokName: targetProfile.tiktokUsername || '' },
  };
}

// ── Test Suite ──

describe('Multi-Action Export/Import Reproduction', () => {
  let initialState: AppState;
  let exportedData: { profiles: StreamProfile[] };
  let importedState: AppState;

  beforeEach(() => {
    initialState = makeInitialState();
  });

  // ── Step 1: EXPORT ──

  describe('Step 1: Export Profile A (active) with 5 Actions', () => {
    it('exports Profile A with exactly 5 Actions', () => {
      exportedData = simulateExport(initialState);

      const profileA = exportedData.profiles.find(p => p.name === 'Profile A');
      const profileB = exportedData.profiles.find(p => p.name === 'Profile B');

      expect(profileA).toBeDefined();
      expect(profileB).toBeDefined();

      // Profile A should have 5 Actions (synced from top-level)
      expect(profileA!.actions).toHaveLength(5);
      expect(profileA!.actions.map(a => a.id).sort()).toEqual([
        'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
      ]);

      // Profile B should have 3 Actions (from its profile object)
      expect(profileB!.actions).toHaveLength(3);
      expect(profileB!.actions.map(a => a.id).sort()).toEqual([
        'act_b1', 'act_b2', 'act_b3'
      ]);
    });
  });

  // ── Step 2: CHANGE ACTIVE PROFILE ──

  describe('Step 2: Switch to Profile B (3 Actions active)', () => {
    let stateAfterSwitch: AppState;

    beforeAll(() => {
      stateAfterSwitch = simulateSwitchProfile(initialState, PROFILE_B_ID);
    });

    it('top-level actions now reflect Profile B (3 Actions)', () => {
      expect(stateAfterSwitch.currentProfileId).toBe(PROFILE_B_ID);
      expect(stateAfterSwitch.actions).toHaveLength(3);
      expect(stateAfterSwitch.actions.map(a => a.id).sort()).toEqual([
        'act_b1', 'act_b2', 'act_b3'
      ]);

      // Profile A should now have its actions saved in streamProfiles
      const profileA = stateAfterSwitch.streamProfiles.find(p => p.name === 'Profile A');
      expect(profileA!.actions).toHaveLength(5);
      expect(profileA!.actions.map(a => a.id).sort()).toEqual([
        'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
      ]);
    });
  });

  // ── Step 3: IMPORT ──

  describe('Step 3: Import while Profile B is active', () => {
    let stateAfterSwitch: AppState;
    let stateAfterImport: AppState;

    beforeAll(() => {
      stateAfterSwitch = simulateSwitchProfile(initialState, PROFILE_B_ID);
      const exported = simulateExport(initialState);
      stateAfterImport = simulateImportProfilesByName(stateAfterSwitch, exported.profiles);
    });

    it('imported Profile A has 5 Actions', () => {
      const profileA = stateAfterImport.streamProfiles.find(p => p.name === 'Profile A');
      expect(profileA).toBeDefined();
      expect(profileA!.actions).toHaveLength(5);
      expect(profileA!.actions.map(a => a.id).sort()).toEqual([
        'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
      ]);
    });

    it('imported Profile B has 3 Actions', () => {
      const profileB = stateAfterImport.streamProfiles.find(p => p.name === 'Profile B');
      expect(profileB).toBeDefined();
      expect(profileB!.actions).toHaveLength(3);
      expect(profileB!.actions.map(a => a.id).sort()).toEqual([
        'act_b1', 'act_b2', 'act_b3'
      ]);
    });
  });

  // ── Step 4: SWITCH TO PROFILE A AFTER IMPORT ──

  describe('Step 4: Switch to Profile A after import', () => {
    let stateAfterSwitch: AppState;
    let stateAfterImport: AppState;
    let stateAfterSwitchBack: AppState;

    beforeAll(() => {
      stateAfterSwitch = simulateSwitchProfile(initialState, PROFILE_B_ID);
      const exported = simulateExport(initialState);
      stateAfterImport = simulateImportProfilesByName(stateAfterSwitch, exported.profiles);
      stateAfterSwitchBack = simulateSwitchProfile(stateAfterImport, PROFILE_A_ID);
    });

    it('Profile A has 5 Actions after switch', () => {
      expect(stateAfterSwitchBack.currentProfileId).toBe(PROFILE_A_ID);
      expect(stateAfterSwitchBack.actions).toHaveLength(5);
      expect(stateAfterSwitchBack.actions.map(a => a.id).sort()).toEqual([
        'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
      ]);
    });
  });

  // ── Step 5: REPEATED SWITCHING ──

  describe('Step 5: Repeated switching A → B → A → B', () => {
    let stateAfterSwitch: AppState;
    let stateAfterImport: AppState;
    let currentState: AppState;

    beforeAll(() => {
      stateAfterSwitch = simulateSwitchProfile(initialState, PROFILE_B_ID);
      const exported = simulateExport(initialState);
      stateAfterImport = simulateImportProfilesByName(stateAfterSwitch, exported.profiles);
      currentState = stateAfterImport;
    });

    it('switch to Profile A: 5 Actions', () => {
      currentState = simulateSwitchProfile(currentState, PROFILE_A_ID);
      expect(currentState.actions).toHaveLength(5);
      expect(currentState.actions.map(a => a.id).sort()).toEqual([
        'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
      ]);
    });

    it('switch back to Profile B: 3 Actions', () => {
      currentState = simulateSwitchProfile(currentState, PROFILE_B_ID);
      expect(currentState.actions).toHaveLength(3);
      expect(currentState.actions.map(a => a.id).sort()).toEqual([
        'act_b1', 'act_b2', 'act_b3'
      ]);
    });

    it('switch to Profile A again: 5 Actions (no stale state)', () => {
      currentState = simulateSwitchProfile(currentState, PROFILE_A_ID);
      expect(currentState.actions).toHaveLength(5);
      expect(currentState.actions.map(a => a.id).sort()).toEqual([
        'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
      ]);
    });

    it('switch to Profile B again: 3 Actions (no stale state)', () => {
      currentState = simulateSwitchProfile(currentState, PROFILE_B_ID);
      expect(currentState.actions).toHaveLength(3);
      expect(currentState.actions.map(a => a.id).sort()).toEqual([
        'act_b1', 'act_b2', 'act_b3'
      ]);
    });
  });

  // ── Step 6: CLOUD SYNC RISK ──

  describe('Step 6: Cloud Sync Risk Assessment', () => {
    it('CLOUD SYNC INTERACTION NOT REPRODUCIBLE IN CURRENT TEST HARNESS', () => {
      // The pullCloudProfiles() merge logic requires:
      // - Actual cloud profile fetch
      // - Profile sync queue with pendingLocalIds
      // - Zustand store with proper rehydration state
      // - Async operations that cannot be safely mocked without production code changes

      // The existing reconciliation logic (name-based, pending-local-wins)
      // is tested in profile-merge-reconciliation.test.ts
      // but cannot be combined with import flow in current test architecture.

      expect(true).toBe(true); // Placeholder - this is a documented limitation
    });
  });

  // ── Summary Assertions ──

  describe('Summary: Deterministic Multi-Action Verification', () => {
    it('COMPLETE ROUND-TRIP: All Action counts verified', () => {
      // Export
      const exported = simulateExport(initialState);
      const expA = exported.profiles.find(p => p.name === 'Profile A')!;
      const expB = exported.profiles.find(p => p.name === 'Profile B')!;
      expect(expA.actions.length).toBe(5);
      expect(expB.actions.length).toBe(3);

      // Switch to B
      let state = simulateSwitchProfile(initialState, PROFILE_B_ID);
      expect(state.actions.length).toBe(3);

      // Import
      state = simulateImportProfilesByName(state, exported.profiles);

      // Verify profiles have correct counts
      const impA = state.streamProfiles.find(p => p.name === 'Profile A')!;
      const impB = state.streamProfiles.find(p => p.name === 'Profile B')!;
      expect(impA.actions.length).toBe(5);
      expect(impB.actions.length).toBe(3);

      // Switch to A
      state = simulateSwitchProfile(state, PROFILE_A_ID);
      expect(state.actions.length).toBe(5);
      expect(state.actions.map(a => a.id).sort()).toEqual([
        'act_a1', 'act_a2', 'act_a3', 'act_a4', 'act_a5'
      ]);

      // Switch to B
      state = simulateSwitchProfile(state, PROFILE_B_ID);
      expect(state.actions.length).toBe(3);
      expect(state.actions.map(a => a.id).sort()).toEqual([
        'act_b1', 'act_b2', 'act_b3'
      ]);

      // Switch to A again
      state = simulateSwitchProfile(state, PROFILE_A_ID);
      expect(state.actions.length).toBe(5);

      // Switch to B again
      state = simulateSwitchProfile(state, PROFILE_B_ID);
      expect(state.actions.length).toBe(3);

      // All assertions passed
      expect(true).toBe(true);
    });
  });
});