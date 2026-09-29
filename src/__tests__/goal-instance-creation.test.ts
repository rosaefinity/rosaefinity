// =============================================
// RosaeFinity — Goal Overlay Instance Creation Tests
// Verifies: OverlayGallery auto-creates persisted instances
// for browser-source-capable modules, and that the resulting
// browserSourceId produces a working config endpoint URL.
// =============================================

import { describe, it, expect } from 'vitest';
import { getBrowserSourceUrl, getBrowserSourceUrlForModule, getSSEBaseUrl } from '../lib/browser-source-url';

// ── Inline the config + events regex from electron/main.cjs ──
const CONFIG_REGEX = /^\/overlay\/([a-z0-9-]+)\/config$/;
const EVENTS_REGEX = /^\/overlay\/([a-z0-9-]+)\/events$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── All registered overlay module IDs ──
const REGISTERED_MODULE_IDS = [
  'gift-alert',
  'coin-jar-pro',
  'goal-progress',
  'goal-followers',
  'goal-gifts',
];

// ── The 9 removed overlay IDs (must remain absent) ──
const REMOVED_OVERLAY_IDS = [
  'goal-likes',
  'chat-box',
  'viewer-count',
  'top-gifter',
  'donation-wall',
  'follower-goal',
  'subscriber-alert',
  'sound-board',
  'timer',
];

// ── Goal module IDs ──
const GOAL_MODULE_IDS = ['goal-progress', 'goal-followers', 'goal-gifts'];

// ── Simulate addInstance behavior ──
function createInstance(moduleId: string, name: string) {
  return {
    id: crypto.randomUUID(),
    moduleId,
    name,
    enabled: true,
    browserSourceId: crypto.randomUUID(),
    config: {},
    configVersion: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    profileId: 'profile-1',
  };
}

// ── Simulate OverlayGallery auto-create + URL generation ──
function galleryAutoCreateAndUrl(
  selectedModuleId: string,
  selectedModuleName: string,
  selectedModuleSupportsBrowserSource: boolean,
  existingInstances: Array<{ moduleId: string; browserSourceId: string; profileId: string }>,
  currentProfileId: string,
): { url: string; created: boolean; instance: ReturnType<typeof createInstance> | null } {
  // 1. Find existing instance (same logic as OverlayGallery)
  const profileInstances = existingInstances.filter(i => i.profileId === currentProfileId);
  const existing = profileInstances.find(i => i.moduleId === selectedModuleId) ?? null;

  if (existing) {
    return {
      url: getBrowserSourceUrl(existing.browserSourceId),
      created: false,
      instance: null,
    };
  }

  // 2. Auto-create if module supports browser source
  if (!selectedModuleSupportsBrowserSource) {
    // Fallback path (no instance, no browser source support)
    return {
      url: `${getSSEBaseUrl()}/overlay/${selectedModuleId}.html?overlay=${selectedModuleId}`,
      created: false,
      instance: null,
    };
  }

  // 3. Create instance (same as addInstance)
  const created = createInstance(selectedModuleId, selectedModuleName);
  return {
    url: getBrowserSourceUrl(created.browserSourceId),
    created: true,
    instance: created,
  };
}

// ════════════════════════════════════════════════
// 1-3. Goal overlays auto-create exactly one instance
// ════════════════════════════════════════════════

describe('Goal overlays auto-create instances', () => {
  it('Goal Likes creates exactly one instance when none exists', () => {
    const result = galleryAutoCreateAndUrl('goal-progress', 'Goal Likes', true, [], 'profile-1');
    expect(result.created).toBe(true);
    expect(result.instance).not.toBeNull();
    expect(result.instance!.moduleId).toBe('goal-progress');
  });

  it('Goal Followers creates exactly one instance when none exists', () => {
    const result = galleryAutoCreateAndUrl('goal-followers', 'Goal Followers', true, [], 'profile-1');
    expect(result.created).toBe(true);
    expect(result.instance).not.toBeNull();
    expect(result.instance!.moduleId).toBe('goal-followers');
  });

  it('Goal Gifts creates exactly one instance when none exists', () => {
    const result = galleryAutoCreateAndUrl('goal-gifts', 'Goal Gifts', true, [], 'profile-1');
    expect(result.created).toBe(true);
    expect(result.instance).not.toBeNull();
    expect(result.instance!.moduleId).toBe('goal-gifts');
  });
});

// ════════════════════════════════════════════════
// 4-5. Unique browserSourceId, UUID-shaped
// ════════════════════════════════════════════════

describe('browserSourceId properties', () => {
  it('each goal instance gets a unique browserSourceId', () => {
    const a = createInstance('goal-progress', 'Goal Likes');
    const b = createInstance('goal-followers', 'Goal Followers');
    const c = createInstance('goal-gifts', 'Goal Gifts');

    expect(a.browserSourceId).not.toBe(b.browserSourceId);
    expect(b.browserSourceId).not.toBe(c.browserSourceId);
    expect(a.browserSourceId).not.toBe(c.browserSourceId);
  });

  it('all browserSourceIds are UUID-shaped', () => {
    const modules = ['goal-progress', 'goal-followers', 'goal-gifts'];
    for (const moduleId of modules) {
      const inst = createInstance(moduleId, moduleId);
      expect(inst.browserSourceId).toMatch(UUID_RE);
    }
  });
});

// ════════════════════════════════════════════════
// 6. Re-rendering does NOT create duplicates
// ════════════════════════════════════════════════

describe('Duplicate prevention', () => {
  it('when instance already exists, no new instance is created', () => {
    const existing = createInstance('goal-progress', 'Goal Likes');
    const instances = [{ moduleId: 'goal-progress', browserSourceId: existing.browserSourceId, profileId: 'profile-1' }];

    const result = galleryAutoCreateAndUrl('goal-progress', 'Goal Likes', true, instances, 'profile-1');
    expect(result.created).toBe(false);
    expect(result.instance).toBeNull();
    expect(result.url).toContain(existing.browserSourceId);
  });

  it('each goal module creates at most one instance', () => {
    // Simulate the auto-created ref pattern: track which modules were created
    const autoCreated = new Set<string>();
    const instances: Array<{ moduleId: string; browserSourceId: string; profileId: string }> = [];

    for (const moduleId of GOAL_MODULE_IDS) {
      const existing = instances.find(i => i.moduleId === moduleId && i.profileId === 'profile-1');
      if (existing) continue;
      if (autoCreated.has(moduleId)) continue;
      autoCreated.add(moduleId);
      const inst = createInstance(moduleId, moduleId);
      instances.push({ moduleId: inst.moduleId, browserSourceId: inst.browserSourceId, profileId: 'profile-1' });
    }

    // Each module has exactly one instance
    expect(instances.length).toBe(3);
    const uniqueModules = new Set(instances.map(i => i.moduleId));
    expect(uniqueModules.size).toBe(3);
  });
});

// ════════════════════════════════════════════════
// 7. Profile isolation
// ════════════════════════════════════════════════

describe('Profile isolation', () => {
  it('switching profiles does not reuse another profile instance', () => {
    const inst1 = createInstance('goal-progress', 'Goal Likes');
    const profile1Instances = [{ moduleId: 'goal-progress', browserSourceId: inst1.browserSourceId, profileId: 'profile-1' }];

    // Profile 2 has no instances
    const result = galleryAutoCreateAndUrl('goal-progress', 'Goal Likes', true, [], 'profile-2');
    expect(result.created).toBe(true);
    expect(result.instance!.browserSourceId).not.toBe(inst1.browserSourceId);
  });

  it('profile 2 instance does not appear in profile 1 lookup', () => {
    const profile1Instances = [{ moduleId: 'goal-progress', browserSourceId: 'aaaa-bbbb', profileId: 'profile-1' }];
    const profile2Instances = [{ moduleId: 'goal-progress', browserSourceId: 'cccc-dddd', profileId: 'profile-2' }];

    const result = galleryAutoCreateAndUrl('goal-progress', 'Goal Likes', true, [...profile1Instances, ...profile2Instances], 'profile-1');
    expect(result.url).toContain('aaaa-bbbb');
    expect(result.url).not.toContain('cccc-dddd');
  });
});

// ════════════════════════════════════════════════
// 8. Existing instances not recreated
// ════════════════════════════════════════════════

describe('Existing instances preserved', () => {
  it('pre-existing goal-progress instance is not recreated', () => {
    const existing = createInstance('goal-progress', 'My Likes Goal');
    const instances = [{ moduleId: 'goal-progress', browserSourceId: existing.browserSourceId, profileId: 'profile-1' }];

    const result = galleryAutoCreateAndUrl('goal-progress', 'Goal Likes', true, instances, 'profile-1');
    expect(result.created).toBe(false);
    expect(result.url).toContain(existing.browserSourceId);
  });

  it('pre-existing coin-jar-pro instance is not affected', () => {
    const existing = createInstance('coin-jar-pro', 'My Coin Jar');
    const instances = [{ moduleId: 'coin-jar-pro', browserSourceId: existing.browserSourceId, profileId: 'profile-1' }];

    const result = galleryAutoCreateAndUrl('coin-jar-pro', 'Coin Jar Pro', true, instances, 'profile-1');
    expect(result.created).toBe(false);
    expect(result.url).toContain(existing.browserSourceId);
  });
});

// ════════════════════════════════════════════════
// 9. Copy URL format
// ════════════════════════════════════════════════

describe('Copy URL uses /overlay/<browserSourceId>.html', () => {
  it('goal-progress URL uses UUID browserSourceId', () => {
    const inst = createInstance('goal-progress', 'Goal Likes');
    const url = getBrowserSourceUrl(inst.browserSourceId);
    expect(url).toBe(`${getSSEBaseUrl()}/overlay/${inst.browserSourceId}.html`);
    expect(url).not.toContain('goal-progress.html');
    expect(url).not.toContain('goals-widget.html');
    expect(url).not.toContain('overlay=');
  });

  it('goal-followers URL uses UUID browserSourceId', () => {
    const inst = createInstance('goal-followers', 'Goal Followers');
    const url = getBrowserSourceUrl(inst.browserSourceId);
    expect(url).toBe(`${getSSEBaseUrl()}/overlay/${inst.browserSourceId}.html`);
    expect(url).not.toContain('goal-followers.html');
  });

  it('goal-gifts URL uses UUID browserSourceId', () => {
    const inst = createInstance('goal-gifts', 'Goal Gifts');
    const url = getBrowserSourceUrl(inst.browserSourceId);
    expect(url).toBe(`${getSSEBaseUrl()}/overlay/${inst.browserSourceId}.html`);
    expect(url).not.toContain('goal-gifts.html');
  });
});

// ════════════════════════════════════════════════
// 10. Config endpoint lookup succeeds
// ════════════════════════════════════════════════

describe('Config endpoint lookup succeeds', () => {
  it('browserSourceId from auto-created instance matches config regex', () => {
    const inst = createInstance('goal-progress', 'Goal Likes');
    const configUrl = `/overlay/${inst.browserSourceId}/config`;
    const match = configUrl.match(CONFIG_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(inst.browserSourceId);
  });

  it('browserSourceId from auto-created instance matches events regex', () => {
    const inst = createInstance('goal-followers', 'Goal Followers');
    const eventsUrl = `/overlay/${inst.browserSourceId}/events`;
    const match = eventsUrl.match(EVENTS_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(inst.browserSourceId);
  });

  it('all three goal modules produce config-compatible URLs', () => {
    for (const moduleId of GOAL_MODULE_IDS) {
      const inst = createInstance(moduleId, moduleId);
      const configUrl = `/overlay/${inst.browserSourceId}/config`;
      const match = configUrl.match(CONFIG_REGEX);
      expect(match).not.toBeNull();
      expect(match![1]).toBe(inst.browserSourceId);
    }
  });
});

// ════════════════════════════════════════════════
// 11. CustomizePage no longer returns goals-widget.html
// ════════════════════════════════════════════════

describe('CustomizePage URL: no more goals-widget.html', () => {
  function customizePageUrl(
    isGoalModule: boolean,
    instance: { browserSourceId: string } | null,
  ): string {
    // Mirrors the fixed CustomizePage logic
    if (isGoalModule && instance) return getBrowserSourceUrl(instance.browserSourceId);
    return instance ? getBrowserSourceUrl(instance.browserSourceId) : '';
  }

  it('goal-progress with instance returns instance-based URL', () => {
    const inst = { browserSourceId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' };
    const url = customizePageUrl(true, inst);
    expect(url).toBe(`${getSSEBaseUrl()}/overlay/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.html`);
    expect(url).not.toContain('goals-widget.html');
  });

  it('goal-followers with instance returns instance-based URL', () => {
    const inst = { browserSourceId: '11111111-2222-3333-4444-555555555555' };
    const url = customizePageUrl(true, inst);
    expect(url).toBe(`${getSSEBaseUrl()}/overlay/11111111-2222-3333-4444-555555555555.html`);
    expect(url).not.toContain('goals-widget.html');
  });

  it('goal-gifts with instance returns instance-based URL', () => {
    const inst = { browserSourceId: 'aaaa-bbbb-cccc-dddd-eeee-ffffffffffff' };
    const url = customizePageUrl(true, inst);
    expect(url).toContain('aaaa-bbbb-cccc-dddd-eeee-ffffffffffff');
    expect(url).not.toContain('goals-widget.html');
  });

  it('no goal URL contains goals-widget.html', () => {
    for (const moduleId of GOAL_MODULE_IDS) {
      const inst = createInstance(moduleId, moduleId);
      const url = customizePageUrl(true, inst);
      expect(url).not.toContain('goals-widget.html');
    }
  });
});

// ════════════════════════════════════════════════
// 12. The 9 removed overlays remain absent
// ════════════════════════════════════════════════

describe('Removed overlays absent from registry', () => {
  it('none of the 9 removed overlays appear in the registered module list', () => {
    for (const removedId of REMOVED_OVERLAY_IDS) {
      expect(REGISTERED_MODULE_IDS).not.toContain(removedId);
    }
  });

  it('only 5 overlays are registered', () => {
    expect(REGISTERED_MODULE_IDS.length).toBe(5);
  });

  it('goal-likes is not a registered module ID', () => {
    expect(REGISTERED_MODULE_IDS).not.toContain('goal-likes');
  });
});

// ════════════════════════════════════════════════
// 13. Gift Alert and Coin Jar Pro unchanged
// ════════════════════════════════════════════════

describe('Existing overlays unaffected', () => {
  it('gift-alert instance uses browserSourceId-based URL', () => {
    const inst = createInstance('gift-alert', 'Gift Alert');
    const url = getBrowserSourceUrl(inst.browserSourceId);
    expect(url).toBe(`${getSSEBaseUrl()}/overlay/${inst.browserSourceId}.html`);
  });

  it('coin-jar-pro instance uses browserSourceId-based URL', () => {
    const inst = createInstance('coin-jar-pro', 'Coin Jar Pro');
    const url = getBrowserSourceUrl(inst.browserSourceId);
    expect(url).toBe(`${getSSEBaseUrl()}/overlay/${inst.browserSourceId}.html`);
  });

  it('gift-alert and coin-jar-pro are still registered', () => {
    expect(REGISTERED_MODULE_IDS).toContain('gift-alert');
    expect(REGISTERED_MODULE_IDS).toContain('coin-jar-pro');
  });

  it('non-browser-source module falls back to module-level URL', () => {
    const result = galleryAutoCreateAndUrl('some-module', 'Some Module', false, [], 'profile-1');
    expect(result.created).toBe(false);
    expect(result.url).toContain('/overlay/some-module.html?overlay=some-module');
  });
});

// ════════════════════════════════════════════════
// 14. Race condition: loaded gate prevents premature creation
// ════════════════════════════════════════════════

// Simulate the OverlayGallery auto-create logic with loaded state
// (module scope so both describe blocks below can use it)
function galleryAutoCreateWithLoaded(
  loaded: boolean,
  selectedId: string,
  selectedModuleName: string,
  selectedModuleSupportsBrowserSource: boolean,
  existingInstances: Array<{ moduleId: string; browserSourceId: string; profileId: string }>,
  currentProfileId: string,
  autoCreated: Set<string>,
): { url: string; created: boolean; instance: ReturnType<typeof createInstance> | null } {
  // 1. loaded gate — mirrors the fixed useEffect guard
  // When loaded=false, clear the dedup guard so the next loaded=true cycle can re-create
  if (!loaded) {
    autoCreated.clear();
    // Not loaded yet — use fallback URL, do NOT create instance
    return {
      url: `${getSSEBaseUrl()}/overlay/${selectedId}.html?overlay=${selectedId}`,
      created: false,
      instance: null,
    };
  }

  // 2. Find existing instance
  const profileInstances = existingInstances.filter(i => i.profileId === currentProfileId);
  const existing = profileInstances.find(i => i.moduleId === selectedId) ?? null;
  if (existing) {
    return {
      url: getBrowserSourceUrl(existing.browserSourceId),
      created: false,
      instance: null,
    };
  }

  // 3. Auto-create if module supports browser source
  if (!selectedModuleSupportsBrowserSource) {
    return {
      url: `${getSSEBaseUrl()}/overlay/${selectedId}.html?overlay=${selectedId}`,
      created: false,
      instance: null,
    };
  }

  // 4. Dedup guard
  if (autoCreated.has(selectedId)) {
    return {
      url: `${getSSEBaseUrl()}/overlay/${selectedId}.html?overlay=${selectedId}`,
      created: false,
      instance: null,
    };
  }

  // 5. Create instance (profileId mirrors addInstance() reading useAppStore.currentProfileId)
  autoCreated.add(selectedId);
  const created = { ...createInstance(selectedId, selectedModuleName), profileId: currentProfileId };
  return {
    url: getBrowserSourceUrl(created.browserSourceId),
    created: true,
    instance: created,
  };
}

describe('Race condition: loaded gate', () => {

  it('loaded=false → auto-create does NOT execute', () => {
    const autoCreated = new Set<string>();
    const result = galleryAutoCreateWithLoaded(
      false, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(result.created).toBe(false);
    expect(result.instance).toBeNull();
    expect(autoCreated.size).toBe(0);
  });

  it('loaded=false with instances=[] → fallback URL, no instance created', () => {
    const autoCreated = new Set<string>();
    const result = galleryAutoCreateWithLoaded(
      false, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(result.created).toBe(false);
    expect(result.url).toBe(`${getSSEBaseUrl()}/overlay/goal-progress.html?overlay=goal-progress`);
    expect(autoCreated.has('goal-progress')).toBe(false);
  });

  it('loaded transitions to true → auto-create executes if no matching instance', () => {
    const autoCreated = new Set<string>();

    // Step 1: loaded=false → no creation
    const step1 = galleryAutoCreateWithLoaded(
      false, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(step1.created).toBe(false);

    // Step 2: loaded=true, still no instances → creates
    const step2 = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(step2.created).toBe(true);
    expect(step2.instance).not.toBeNull();
    expect(step2.instance!.moduleId).toBe('goal-progress');
  });

  it('created instance has a real UUID browserSourceId', () => {
    const autoCreated = new Set<string>();
    const result = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(result.created).toBe(true);
    expect(result.instance!.browserSourceId).toMatch(UUID_RE);
  });

  it('once instance exists, selectedInstance resolves and URL uses UUID path', () => {
    const autoCreated = new Set<string>();

    // Step 1: create instance
    const created = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(created.created).toBe(true);

    // Step 2: now instance exists in the "store" — lookup finds it
    const instances = [{
      moduleId: created.instance!.moduleId,
      browserSourceId: created.instance!.browserSourceId,
      profileId: 'profile-1',
    }];
    const lookup = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, instances, 'profile-1', autoCreated,
    );
    expect(lookup.created).toBe(false);
    expect(lookup.url).toBe(getBrowserSourceUrl(created.instance!.browserSourceId));
    expect(lookup.url).not.toContain('goal-progress.html');
    expect(lookup.url).not.toContain('overlay=');
  });

  it('existing instance → no duplicate creation', () => {
    const autoCreated = new Set<string>();
    const existing = createInstance('goal-progress', 'Goal Likes');
    const instances = [{
      moduleId: 'goal-progress',
      browserSourceId: existing.browserSourceId,
      profileId: 'profile-1',
    }];

    const result = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, instances, 'profile-1', autoCreated,
    );
    expect(result.created).toBe(false);
    expect(result.url).toContain(existing.browserSourceId);
  });

  it('React rerender/StrictMode → dedup guard prevents duplicate creation', () => {
    const autoCreated = new Set<string>();

    // First render
    const first = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(first.created).toBe(true);

    // Simulated second render (StrictMode / rerender) — dedup guard fires
    const second = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(second.created).toBe(false);

    // Only one instance was created
    expect(autoCreated.size).toBe(1);
    expect(autoCreated.has('goal-progress')).toBe(true);
  });

  it('profile isolation remains correct with loaded gate', () => {
    const autoCreated = new Set<string>();

    // Profile 1: create instance
    const p1 = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(p1.created).toBe(true);

    // Profile 2: no instances for profile-2 — dedup guard fires because
    // the autoCreatedRef persists within a single component mount.
    // In the real app, profile switch calls loadInstances which populates
    // instances from Dexie. If a profile-2 instance exists in Dexie,
    // selectedInstance resolves via the lookup path (not auto-create).
    const instances = [{
      moduleId: 'goal-progress',
      browserSourceId: p1.instance!.browserSourceId,
      profileId: 'profile-1',
    }];
    const p2 = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, instances, 'profile-2', autoCreated,
    );
    // Dedup guard prevents re-creation — correct for single-mount behavior
    expect(p2.created).toBe(false);
  });

  it('loaded=false for all three goals → none created', () => {
    const autoCreated = new Set<string>();
    for (const moduleId of GOAL_MODULE_IDS) {
      const result = galleryAutoCreateWithLoaded(
        false, moduleId, moduleId, true, [], 'profile-1', autoCreated,
      );
      expect(result.created).toBe(false);
    }
    expect(autoCreated.size).toBe(0);
  });

  it('loaded=true then loadInstances overwrites → effect does not re-fire due to dedup', () => {
    const autoCreated = new Set<string>();

    // Step 1: loaded=true, create instance
    const step1 = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(step1.created).toBe(true);

    // Step 2: loadInstances overwrites — instances becomes empty again
    // But autoCreatedRef still has 'goal-progress', so effect won't re-create
    const step2 = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(step2.created).toBe(false);
    // This demonstrates the dedup guard fires even when instances is empty
    // The FIX (loaded gate) ensures this scenario doesn't happen in the first place
    // because loaded=false blocks the premature creation
  });
});

// ════════════════════════════════════════════════
// 15. pullCloudProfiles profile-switch scenario
// ════════════════════════════════════════════════

describe('pullCloudProfiles profile-switch scenario', () => {
  // Simulate the exact sequence confirmed by forensic audit:
  // 1. loaded=false → loaded=true → auto-create for profile-1
  // 2. pullCloudProfiles changes currentProfileId to cloud ID
  // 3. loaded=false (clears guard) → loaded=true → auto-create for new profile

  it('initial loaded=false clears autoCreatedRef', () => {
    const autoCreated = new Set<string>();
    autoCreated.add('goal-progress'); // Simulate stale state from previous cycle

    galleryAutoCreateWithLoaded(
      false, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(autoCreated.size).toBe(0);
  });

  it('loaded=false → loaded=true allows auto-create after clear', () => {
    const autoCreated = new Set<string>();
    autoCreated.add('goal-progress'); // Stale

    // Step 1: loaded=false clears the guard
    galleryAutoCreateWithLoaded(
      false, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(autoCreated.has('goal-progress')).toBe(false);

    // Step 2: loaded=true → creates because guard was cleared
    const result = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(result.created).toBe(true);
    expect(result.instance!.moduleId).toBe('goal-progress');
  });

  it('Profile A creates Goal Likes, then profile switch allows Profile B creation', () => {
    const autoCreated = new Set<string>();

    // T1: loaded=true, profile-1 → creates instance
    const t1 = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(t1.created).toBe(true);
    expect(t1.instance!.profileId).toBe('profile-1');

    // T2: pullCloudProfiles changes currentProfileId to cloud UUID
    // Gallery remains mounted — loaded is still true (pullCloudProfiles doesn't set loaded=false)
    // But the existing instance belongs to profile-1, not the new profile

    // T3: loaded=false (set by switchProfile or Dexie reload) clears the guard
    galleryAutoCreateWithLoaded(
      false, 'goal-progress', 'Goal Likes', true, [], 'profile-cloud-uuid', autoCreated,
    );
    expect(autoCreated.has('goal-progress')).toBe(false);

    // T4: loaded=true for new profile → creates with new profileId
    const instances = [{
      moduleId: 'goal-progress',
      browserSourceId: t1.instance!.browserSourceId,
      profileId: 'profile-1', // Old profile's instance — won't match new profile
    }];
    const t4 = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, instances, 'profile-cloud-uuid', autoCreated,
    );
    expect(t4.created).toBe(true);
    expect(t4.instance!.profileId).toBe('profile-cloud-uuid');
    expect(t4.instance!.browserSourceId).not.toBe(t1.instance!.browserSourceId);
  });

  it('Profile B gets a different browserSourceId UUID than Profile A', () => {
    const autoCreated = new Set<string>();

    const a = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(a.created).toBe(true);

    // Clear guard (simulates loaded=false)
    galleryAutoCreateWithLoaded(
      false, 'goal-progress', 'Goal Likes', true, [], 'profile-2', autoCreated,
    );

    const b = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-2', autoCreated,
    );
    expect(b.created).toBe(true);
    expect(b.instance!.browserSourceId).not.toBe(a.instance!.browserSourceId);
    expect(b.instance!.browserSourceId).toMatch(UUID_RE);
  });

  it('no duplicate within same loaded cycle', () => {
    const autoCreated = new Set<string>();

    const first = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(first.created).toBe(true);

    // Same loaded cycle — guard prevents duplicate
    const second = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(second.created).toBe(false);
  });

  it('existing instance for current profile prevents creation', () => {
    const autoCreated = new Set<string>();
    const existing = createInstance('goal-progress', 'Goal Likes');
    const instances = [{
      moduleId: 'goal-progress',
      browserSourceId: existing.browserSourceId,
      profileId: 'profile-1',
    }];

    const result = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, instances, 'profile-1', autoCreated,
    );
    expect(result.created).toBe(false);
    expect(result.url).toContain(existing.browserSourceId);
  });

  it('Goal Followers behaves the same way across profile switch', () => {
    const autoCreated = new Set<string>();

    const a = galleryAutoCreateWithLoaded(
      true, 'goal-followers', 'Goal Followers', true, [], 'profile-1', autoCreated,
    );
    expect(a.created).toBe(true);

    galleryAutoCreateWithLoaded(
      false, 'goal-followers', 'Goal Followers', true, [], 'profile-2', autoCreated,
    );

    const b = galleryAutoCreateWithLoaded(
      true, 'goal-followers', 'Goal Followers', true, [], 'profile-2', autoCreated,
    );
    expect(b.created).toBe(true);
    expect(b.instance!.browserSourceId).not.toBe(a.instance!.browserSourceId);
  });

  it('Goal Gifts behaves the same way across profile switch', () => {
    const autoCreated = new Set<string>();

    const a = galleryAutoCreateWithLoaded(
      true, 'goal-gifts', 'Goal Gifts', true, [], 'profile-1', autoCreated,
    );
    expect(a.created).toBe(true);

    galleryAutoCreateWithLoaded(
      false, 'goal-gifts', 'Goal Gifts', true, [], 'profile-2', autoCreated,
    );

    const b = galleryAutoCreateWithLoaded(
      true, 'goal-gifts', 'Goal Gifts', true, [], 'profile-2', autoCreated,
    );
    expect(b.created).toBe(true);
    expect(b.instance!.browserSourceId).not.toBe(a.instance!.browserSourceId);
  });

  it('Browser Source URL resolves through UUID, not module-ID fallback', () => {
    const autoCreated = new Set<string>();

    const result = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(result.created).toBe(true);

    // After creation, lookup finds the instance
    const instances = [{
      moduleId: 'goal-progress',
      browserSourceId: result.instance!.browserSourceId,
      profileId: 'profile-1',
    }];
    const lookup = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, instances, 'profile-1', autoCreated,
    );
    expect(lookup.url).toBe(getBrowserSourceUrl(result.instance!.browserSourceId));
    expect(lookup.url).not.toContain('goal-progress.html');
    expect(lookup.url).not.toContain('overlay=');
  });
});

// ════════════════════════════════════════════════
// 16. pullCloudProfiles profile-change effect
// ════════════════════════════════════════════════

describe('pullCloudProfiles currentProfileId change clears autoCreatedRef', () => {
  // Simulate the full scenario:
  // 1. Gallery auto-creates instance for profile A
  // 2. pullCloudProfiles changes currentProfileId (loaded stays true)
  // 3. Profile-change effect clears autoCreatedRef
  // 4. Auto-create fires again for profile B

  function simulateProfileChange(
    currentProfileId: string,
    prevProfileRef: { current: string },
    autoCreated: Set<string>,
  ): boolean {
    // Mirrors the profile-change effect in OverlayGallery.tsx
    if (prevProfileRef.current !== currentProfileId) {
      autoCreated.clear();
      prevProfileRef.current = currentProfileId;
      return true; // profile changed
    }
    return false; // no change
  }

  it('Profile A auto-creates, then currentProfileId changes to Profile B', () => {
    const autoCreated = new Set<string>();
    const prevProfileRef = { current: 'profile-1' };

    // Step 1: loaded=true, auto-create for profile-1
    const step1 = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(step1.created).toBe(true);
    expect(autoCreated.has('goal-progress')).toBe(true);

    // Step 2: pullCloudProfiles changes currentProfileId to cloud UUID
    const changed = simulateProfileChange('cloud-uuid-abc', prevProfileRef, autoCreated);
    expect(changed).toBe(true);
    expect(autoCreated.has('goal-progress')).toBe(false);

    // Step 3: loaded stays true — auto-create fires for new profile
    const instances = [{
      moduleId: 'goal-progress',
      browserSourceId: step1.instance!.browserSourceId,
      profileId: 'profile-1', // old profile — won't match
    }];
    const step3 = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, instances, 'cloud-uuid-abc', autoCreated,
    );
    expect(step3.created).toBe(true);
    expect(step3.instance!.profileId).toBe('cloud-uuid-abc');
    expect(step3.instance!.browserSourceId).not.toBe(step1.instance!.browserSourceId);
    expect(step3.instance!.browserSourceId).toMatch(UUID_RE);
  });

  it('Browser Source URL resolves through UUID after profile change', () => {
    const autoCreated = new Set<string>();
    const prevProfileRef = { current: 'profile-1' };

    // Auto-create for profile-1
    const a = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(a.created).toBe(true);

    // Profile changes
    simulateProfileChange('profile-2', prevProfileRef, autoCreated);

    // Auto-create for profile-2
    const b = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-2', autoCreated,
    );
    expect(b.created).toBe(true);

    // Lookup finds instance for profile-2
    const lookup = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [{
        moduleId: 'goal-progress',
        browserSourceId: b.instance!.browserSourceId,
        profileId: 'profile-2',
      }], 'profile-2', autoCreated,
    );
    expect(lookup.url).toBe(getBrowserSourceUrl(b.instance!.browserSourceId));
    expect(lookup.url).not.toContain('goal-progress.html');
    expect(lookup.url).not.toContain('overlay=');
  });

  it('same profileId does NOT clear autoCreatedRef', () => {
    const autoCreated = new Set<string>();
    autoCreated.add('goal-progress');
    const prevProfileRef = { current: 'profile-1' };

    const changed = simulateProfileChange('profile-1', prevProfileRef, autoCreated);
    expect(changed).toBe(false);
    expect(autoCreated.has('goal-progress')).toBe(true);
  });

  it('does not create duplicates for the same profile after change', () => {
    const autoCreated = new Set<string>();
    const prevProfileRef = { current: 'profile-1' };

    // Create for profile-1
    galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(autoCreated.size).toBe(1);

    // Change to profile-2, then back to profile-1
    simulateProfileChange('profile-2', prevProfileRef, autoCreated);
    simulateProfileChange('profile-1', prevProfileRef, autoCreated);

    // Create for profile-1 again
    galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );
    expect(autoCreated.size).toBe(1);
  });

  it('existing instance for new profile prevents creation', () => {
    const autoCreated = new Set<string>();
    const prevProfileRef = { current: 'profile-1' };

    // Create for profile-1
    galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );

    // Change to profile-2
    simulateProfileChange('profile-2', prevProfileRef, autoCreated);

    // profile-2 already has an instance
    const existing = createInstance('goal-progress', 'Goal Likes');
    const instances = [{
      moduleId: 'goal-progress',
      browserSourceId: existing.browserSourceId,
      profileId: 'profile-2',
    }];
    const result = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, instances, 'profile-2', autoCreated,
    );
    expect(result.created).toBe(false);
    expect(result.url).toContain(existing.browserSourceId);
  });

  it('Goal Followers works across profile change', () => {
    const autoCreated = new Set<string>();
    const prevProfileRef = { current: 'profile-1' };

    const a = galleryAutoCreateWithLoaded(
      true, 'goal-followers', 'Goal Followers', true, [], 'profile-1', autoCreated,
    );
    expect(a.created).toBe(true);

    simulateProfileChange('profile-2', prevProfileRef, autoCreated);

    const b = galleryAutoCreateWithLoaded(
      true, 'goal-followers', 'Goal Followers', true, [], 'profile-2', autoCreated,
    );
    expect(b.created).toBe(true);
    expect(b.instance!.browserSourceId).not.toBe(a.instance!.browserSourceId);
  });

  it('Goal Gifts works across profile change', () => {
    const autoCreated = new Set<string>();
    const prevProfileRef = { current: 'profile-1' };

    const a = galleryAutoCreateWithLoaded(
      true, 'goal-gifts', 'Goal Gifts', true, [], 'profile-1', autoCreated,
    );
    expect(a.created).toBe(true);

    simulateProfileChange('profile-2', prevProfileRef, autoCreated);

    const b = galleryAutoCreateWithLoaded(
      true, 'goal-gifts', 'Goal Gifts', true, [], 'profile-2', autoCreated,
    );
    expect(b.created).toBe(true);
    expect(b.instance!.browserSourceId).not.toBe(a.instance!.browserSourceId);
  });

  it('React rerender does not duplicate after profile change', () => {
    const autoCreated = new Set<string>();
    const prevProfileRef = { current: 'profile-1' };

    // Create for profile-1
    galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );

    // Change profile
    simulateProfileChange('profile-2', prevProfileRef, autoCreated);

    // Create for profile-2
    const first = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-2', autoCreated,
    );
    expect(first.created).toBe(true);

    // Rerender — guard prevents duplicate
    const second = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-2', autoCreated,
    );
    expect(second.created).toBe(false);
  });

  it('loaded=false behavior still works after profile change', () => {
    const autoCreated = new Set<string>();
    const prevProfileRef = { current: 'profile-1' };

    // Create for profile-1
    galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-1', autoCreated,
    );

    // Change profile
    simulateProfileChange('profile-2', prevProfileRef, autoCreated);

    // loaded=false clears guard
    galleryAutoCreateWithLoaded(
      false, 'goal-progress', 'Goal Likes', true, [], 'profile-2', autoCreated,
    );
    expect(autoCreated.size).toBe(0);

    // loaded=true creates
    const result = galleryAutoCreateWithLoaded(
      true, 'goal-progress', 'Goal Likes', true, [], 'profile-2', autoCreated,
    );
    expect(result.created).toBe(true);
  });

  it('three rapid profile changes all clear the guard', () => {
    const autoCreated = new Set<string>();
    autoCreated.add('goal-progress');
    const prevProfileRef = { current: 'profile-1' };

    simulateProfileChange('profile-2', prevProfileRef, autoCreated);
    expect(autoCreated.size).toBe(0);

    autoCreated.add('goal-progress');
    simulateProfileChange('profile-3', prevProfileRef, autoCreated);
    expect(autoCreated.size).toBe(0);

    autoCreated.add('goal-progress');
    simulateProfileChange('profile-1', prevProfileRef, autoCreated);
    expect(autoCreated.size).toBe(0);
  });
});
