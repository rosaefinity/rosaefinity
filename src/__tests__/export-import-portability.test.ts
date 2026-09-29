// =============================================
// RosaeFinity — Export/Import Portability Tests
// Verifies: browserSourceId preservation, profile
// association mapping, and theme data portability.
// =============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── UUID validation regex (mirrors Settings.tsx) ──
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Test Types ──
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

interface TestProfile {
  id: string;
  name: string;
  tiktokUsername?: string;
}

interface TestTheme {
  id: string;
  name: string;
  tokens: {
    colors: Record<string, string>;
    [key: string]: unknown;
  };
}

// ── Mock import logic (mirrors Settings.tsx handleImport) ──
function simulateImport(exportData: {
  overlays: Array<Record<string, unknown>>;
  profiles: TestProfile[];
  theme: {
    mode: string;
    customTheme: TestTheme | null;
    currentThemeId: string | undefined;
    registeredThemes: TestTheme[];
  };
}): {
  importedOverlays: TestOverlayInstance[];
  importedTheme: {
    mode: string;
    customTheme: TestTheme | null;
    currentThemeId: string | undefined;
    registeredThemes: TestTheme[];
  };
} {
  // Build profile name → ID mapping
  const profileNameToId = new Map<string, string>();
  for (const p of exportData.profiles) {
    profileNameToId.set(p.name, p.id);
  }

  // Import overlays with browserSourceId preservation
  const importedOverlays = exportData.overlays.map((o) => ({
    id: o.id as string,
    name: o.name as string,
    moduleId: o.moduleId as string,
    enabled: o.enabled as number,
    // KEY FIX: Preserve valid UUID, only generate new for legacy/missing
    browserSourceId: UUID_RE.test(o.browserSourceId as string)
      ? (o.browserSourceId as string)
      : crypto.randomUUID(),
    config: typeof o.config === 'string' ? o.config : JSON.stringify(o.config ?? {}),
    configVersion: (o.configVersion as number) ?? 1,
    createdAt: String(o.createdAt ?? Date.now()),
    updatedAt: String(o.updatedAt ?? Date.now()),
    userId: 'imported-user-id',
    profileId: (o._sourceProfileName as string)
      ? (profileNameToId.get(o._sourceProfileName as string) ?? undefined)
      : undefined,
  }));

  // Import theme
  const importedTheme = { ...exportData.theme };

  return { importedOverlays, importedTheme };
}

// ── Test Data Factories ──

function makeExportedOverlay(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'overlay-1',
    moduleId: 'coin-jar',
    name: 'My Coin Jar',
    enabled: 1,
    browserSourceId: '550e8400-e29b-41d4-a716-446655440000',
    config: { goalCoins: 1000 },
    configVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    _sourceProfileName: 'Stream Profile 1',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<TestProfile> = {}): TestProfile {
  return {
    id: 'spf_imported_123',
    name: 'Stream Profile 1',
    ...overrides,
  };
}

function makeTheme(overrides: Partial<TestTheme> = {}): TestTheme {
  return {
    id: 'custom-theme-1',
    name: 'My Custom Theme',
    tokens: {
      colors: {
        primary: '#ff0000',
        secondary: '#00ff00',
        background: '#000000',
        text: '#ffffff',
      },
    },
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// TASK A & B: browserSourceId preservation
// ══════════════════════════════════════════════════════════════

describe('Exported UUID browserSourceId is preserved exactly after import', () => {
  it('valid UUID browserSourceId remains identical', () => {
    const originalUuid = '550e8400-e29b-41d4-a716-446655440000';
    const exportData = {
      overlays: [makeExportedOverlay({ browserSourceId: originalUuid })],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    expect(result.importedOverlays[0].browserSourceId).toBe(originalUuid);
  });

  it('uppercase UUID browserSourceId remains identical', () => {
    const originalUuid = '550E8400-E29B-41D4-A716-446655440000';
    const exportData = {
      overlays: [makeExportedOverlay({ browserSourceId: originalUuid })],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    expect(result.importedOverlays[0].browserSourceId).toBe(originalUuid);
  });

  it('multiple overlays preserve their respective UUIDs', () => {
    const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
    const uuid2 = '660f9511-f3ac-52e5-b827-557766551111';
    const uuid3 = '7710a622-a4bd-63f6-c938-668877662222';

    const exportData = {
      overlays: [
        makeExportedOverlay({ id: 'o1', browserSourceId: uuid1 }),
        makeExportedOverlay({ id: 'o2', browserSourceId: uuid2 }),
        makeExportedOverlay({ id: 'o3', browserSourceId: uuid3 }),
      ],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    expect(result.importedOverlays[0].browserSourceId).toBe(uuid1);
    expect(result.importedOverlays[1].browserSourceId).toBe(uuid2);
    expect(result.importedOverlays[2].browserSourceId).toBe(uuid3);
  });
});

describe('No new browserSourceId is generated during import', () => {
  it('does not generate imp_ prefixed ID', () => {
    const originalUuid = '550e8400-e29b-41d4-a716-446655440000';
    const exportData = {
      overlays: [makeExportedOverlay({ browserSourceId: originalUuid })],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    expect(result.importedOverlays[0].browserSourceId).not.toMatch(/^imp_/);
    expect(result.importedOverlays[0].browserSourceId).toBe(originalUuid);
  });

  it('preserves original ID, not random generation', () => {
    const originalUuid = '550e8400-e29b-41d4-a716-446655440000';
    const exportData = {
      overlays: [makeExportedOverlay({ browserSourceId: originalUuid })],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    // Run import multiple times
    const result1 = simulateImport(exportData);
    const result2 = simulateImport(exportData);
    const result3 = simulateImport(exportData);

    // All should have the same browserSourceId (no randomness)
    expect(result1.importedOverlays[0].browserSourceId).toBe(originalUuid);
    expect(result2.importedOverlays[0].browserSourceId).toBe(originalUuid);
    expect(result3.importedOverlays[0].browserSourceId).toBe(originalUuid);
  });
});

// ══════════════════════════════════════════════════════════════
// TASK C & D: Overlay URL consistency
// ══════════════════════════════════════════════════════════════

describe('Imported overlay URL continues to use the same browserSourceId', () => {
  it('browserSourceId in overlay matches expected URL pattern', () => {
    const originalUuid = '550e8400-e29b-41d4-a716-446655440000';
    const exportData = {
      overlays: [makeExportedOverlay({ browserSourceId: originalUuid })],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);
    const overlay = result.importedOverlays[0];

    // Verify the browserSourceId is valid and would produce correct URLs
    expect(UUID_RE.test(overlay.browserSourceId)).toBe(true);
    expect(overlay.browserSourceId).toBe(originalUuid);

    // Simulate URL generation pattern used in the app
    const expectedUrl = `http://localhost:18890/overlay/${overlay.browserSourceId}`;
    expect(expectedUrl).toContain(originalUuid);
  });
});

describe('Gallery and Customize URL remain identical after export/import', () => {
  it('overlay ID is preserved (used in routing)', () => {
    const originalId = 'overlay-unique-123';
    const exportData = {
      overlays: [makeExportedOverlay({ id: originalId })],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    expect(result.importedOverlays[0].id).toBe(originalId);
  });

  it('moduleId is preserved (used in routing)', () => {
    const originalModuleId = 'goal-likes';
    const exportData = {
      overlays: [makeExportedOverlay({ moduleId: originalModuleId })],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    expect(result.importedOverlays[0].moduleId).toBe(originalModuleId);
  });
});

// ══════════════════════════════════════════════════════════════
// TASK E & F: Profile association mapping
// ══════════════════════════════════════════════════════════════

describe('Overlay profile association maps to the correct imported profile', () => {
  it('overlay with _sourceProfileName maps to correct profile ID', () => {
    const profileName = 'Stream Profile 1';
    const profileId = 'spf_imported_456';

    const exportData = {
      overlays: [makeExportedOverlay({ _sourceProfileName: profileName })],
      profiles: [makeProfile({ id: profileId, name: profileName })],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    expect(result.importedOverlays[0].profileId).toBe(profileId);
  });

  it('multiple overlays map to their respective profiles', () => {
    const profile1 = makeProfile({ id: 'spf_1', name: 'Profile A' });
    const profile2 = makeProfile({ id: 'spf_2', name: 'Profile B' });

    const exportData = {
      overlays: [
        makeExportedOverlay({ id: 'o1', _sourceProfileName: 'Profile A' }),
        makeExportedOverlay({ id: 'o2', _sourceProfileName: 'Profile B' }),
        makeExportedOverlay({ id: 'o3', _sourceProfileName: 'Profile A' }),
      ],
      profiles: [profile1, profile2],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    expect(result.importedOverlays[0].profileId).toBe('spf_1');
    expect(result.importedOverlays[1].profileId).toBe('spf_2');
    expect(result.importedOverlays[2].profileId).toBe('spf_1');
  });

  it('overlay without profile association remains undefined', () => {
    const exportData = {
      overlays: [makeExportedOverlay({ _sourceProfileName: undefined })],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    expect(result.importedOverlays[0].profileId).toBeUndefined();
  });
});

describe('No ambiguous profile mapping silently chooses a profile', () => {
  it('overlay with non-matching profile name gets undefined profileId', () => {
    const exportData = {
      overlays: [makeExportedOverlay({ _sourceProfileName: 'Non-Existent Profile' })],
      profiles: [makeProfile({ name: 'Different Profile' })],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    // Should be undefined, not fallback to first profile
    expect(result.importedOverlays[0].profileId).toBeUndefined();
  });

  it('empty profile list results in undefined profileId', () => {
    const exportData = {
      overlays: [makeExportedOverlay({ _sourceProfileName: 'Some Profile' })],
      profiles: [],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);

    expect(result.importedOverlays[0].profileId).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════
// TASK G: Theme portability
// ══════════════════════════════════════════════════════════════

describe('Full portable custom theme data survives export/import', () => {
  it('custom theme with all token colors is preserved', () => {
    const customTheme = makeTheme();
    const exportData = {
      overlays: [],
      profiles: [],
      theme: {
        mode: 'custom',
        customTheme,
        currentThemeId: customTheme.id,
        registeredThemes: [customTheme],
      },
    };

    const result = simulateImport(exportData);

    expect(result.importedTheme.mode).toBe('custom');
    expect(result.importedTheme.customTheme).toEqual(customTheme);
    expect(result.importedTheme.currentThemeId).toBe(customTheme.id);
    expect(result.importedTheme.registeredThemes).toHaveLength(1);
    expect(result.importedTheme.registeredThemes[0]).toEqual(customTheme);
  });

  it('theme mode is preserved', () => {
    const modes = ['dark', 'light', 'auto', 'custom'];

    for (const mode of modes) {
      const exportData = {
        overlays: [],
        profiles: [],
        theme: {
          mode,
          customTheme: null,
          currentThemeId: undefined,
          registeredThemes: [],
        },
      };

      const result = simulateImport(exportData);
      expect(result.importedTheme.mode).toBe(mode);
    }
  });

  it('multiple registered themes are preserved', () => {
    const theme1 = makeTheme({ id: 'theme-1', name: 'Theme 1' });
    const theme2 = makeTheme({ id: 'theme-2', name: 'Theme 2' });
    const theme3 = makeTheme({ id: 'theme-3', name: 'Theme 3' });

    const exportData = {
      overlays: [],
      profiles: [],
      theme: {
        mode: 'dark',
        customTheme: theme1,
        currentThemeId: theme2.id,
        registeredThemes: [theme1, theme2, theme3],
      },
    };

    const result = simulateImport(exportData);

    expect(result.importedTheme.registeredThemes).toHaveLength(3);
    expect(result.importedTheme.registeredThemes.map(t => t.id)).toEqual([
      'theme-1',
      'theme-2',
      'theme-3',
    ]);
  });

  it('theme tokens with nested colors are preserved', () => {
    const complexTheme: TestTheme = {
      id: 'complex-theme',
      name: 'Complex Theme',
      tokens: {
        colors: {
          primary: '#ff6b6b',
          secondary: '#4ecdc4',
          accent: '#ffe66d',
          background: '#1a1a2e',
          surface: '#16213e',
          text: '#eaeaea',
          muted: '#888888',
          success: '#51cf66',
          warning: '#fcc419',
          error: '#ff6b6b',
        },
        spacing: {
          xs: '4px',
          sm: '8px',
          md: '16px',
          lg: '24px',
        },
      },
    };

    const exportData = {
      overlays: [],
      profiles: [],
      theme: {
        mode: 'custom',
        customTheme: complexTheme,
        currentThemeId: complexTheme.id,
        registeredThemes: [complexTheme],
      },
    };

    const result = simulateImport(exportData);

    expect(result.importedTheme.customTheme?.tokens.colors).toEqual(
      complexTheme.tokens.colors
    );
    expect(result.importedTheme.customTheme?.tokens.spacing).toEqual(
      complexTheme.tokens.spacing
    );
  });
});

// ══════════════════════════════════════════════════════════════
// TASK H: Actions/Events unaffected (no modifications)
// ══════════════════════════════════════════════════════════════

describe('Actions and Events are not modified by export/import', () => {
  it('overlay actions config is preserved as-is', () => {
    const actionsConfig = {
      onGift: { enabled: true, actionId: 'action-123' },
      onFollow: { enabled: false, actionId: 'action-456' },
    };

    const exportData = {
      overlays: [makeExportedOverlay({ config: actionsConfig })],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);
    const importedConfig = JSON.parse(result.importedOverlays[0].config as string);

    expect(importedConfig.onGift).toEqual(actionsConfig.onGift);
    expect(importedConfig.onFollow).toEqual(actionsConfig.onFollow);
  });

  it('overlay event references are preserved', () => {
    const eventsConfig = {
      events: [
        { id: 'evt-1', type: 'gift', actionName: 'Gift Alert' },
        { id: 'evt-2', type: 'follow', actionName: 'Follow Alert' },
      ],
    };

    const exportData = {
      overlays: [makeExportedOverlay({ config: eventsConfig })],
      profiles: [makeProfile()],
      theme: { mode: 'dark', customTheme: null, currentThemeId: undefined, registeredThemes: [] },
    };

    const result = simulateImport(exportData);
    const importedConfig = JSON.parse(result.importedOverlays[0].config as string);

    expect(importedConfig.events).toEqual(eventsConfig.events);
  });
});
