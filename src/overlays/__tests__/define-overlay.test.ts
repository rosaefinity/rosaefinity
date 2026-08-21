import { describe, it, expect } from 'vitest';
import { defineOverlay } from '../defineOverlay';
import React from 'react';

const TestRenderer: React.FC<{ config: Record<string, unknown>; mode: 'preview' | 'browser-source' }> = () => null;
const TestIcon: React.FC<{ className?: string }> = () => null;

describe('defineOverlay', () => {
  it('returns a valid OverlayModule descriptor', () => {
    const mod = defineOverlay({
      id: 'test-overlay',
      name: 'Test Overlay',
      description: 'A test overlay',
      category: 'alerts',
      icon: TestIcon,
      tags: ['test'],
      supportsBrowserSource: true,
      supportsPreview: true,
      version: 1,
      configVersion: 1,
      renderer: TestRenderer,
      settingsSchema: [],
      defaultConfig: { color: 'red' },
      validate: (c): c is { color: string } => typeof c === 'object' && c !== null && 'color' in c,
      sanitize: (c) => ({ color: String(c.color ?? 'red') }),
      migrate: (raw) => (raw as { color: string }) ?? { color: 'red' },
    });

    expect(mod.id).toBe('test-overlay');
    expect(mod.name).toBe('Test Overlay');
    expect(mod.category).toBe('alerts');
    expect(mod.renderer).toBe(TestRenderer);
    expect(Array.isArray(mod.settingsSchema)).toBe(true);
    expect(mod.validate({ color: 'blue' })).toBe(true);
    expect(mod.validate({})).toBe(false);
    expect(mod.sanitize({})).toEqual({ color: 'red' });
    expect(mod.migrate(null)).toEqual({ color: 'red' });
  });

  it('settingsSchema is an array of SettingsSection', () => {
    const mod = defineOverlay({
      id: 'test',
      name: 'Test',
      description: 'Test',
      category: 'alerts',
      icon: TestIcon,
      tags: [],
      supportsBrowserSource: true,
      supportsPreview: true,
      version: 1,
      configVersion: 1,
      renderer: TestRenderer,
      settingsSchema: [
        {
          title: 'Appearance',
          fields: [
            { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
          ],
        },
      ],
      defaultConfig: {},
      validate: (c): c is Record<string, unknown> => true,
      sanitize: (c) => c,
      migrate: () => ({}),
    });

    expect(mod.settingsSchema).toHaveLength(1);
    const section = mod.settingsSchema[0] as { title: string; fields: unknown[] };
    expect(section.title).toBe('Appearance');
    expect(section.fields).toHaveLength(1);
  });
});
