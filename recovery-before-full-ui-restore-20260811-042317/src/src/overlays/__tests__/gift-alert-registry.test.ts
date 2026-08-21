import { describe, it, expect } from 'vitest';
import { getOverlayModule, getOverlayModules, hasOverlay, getOverlaysByCategory } from '../registry';

describe('Gift Alert Registry Integration', () => {
  it('registry contains gift-alert', () => {
    const modules = getOverlayModules();
    expect(modules.length).toBeGreaterThanOrEqual(1);
    expect(modules.some(m => m.id === 'gift-alert')).toBe(true);
  });

  it('getOverlayModule("gift-alert") returns the module', () => {
    const mod = getOverlayModule('gift-alert');
    expect(mod).toBeDefined();
    expect(mod?.id).toBe('gift-alert');
    expect(mod?.name).toBe('Gift Alert');
    expect(mod?.category).toBe('alerts');
  });

  it('hasOverlay("gift-alert") === true', () => {
    expect(hasOverlay('gift-alert')).toBe(true);
  });

  it('getOverlaysByCategory("alerts") contains Gift Alert', () => {
    const alerts = getOverlaysByCategory('alerts');
    expect(alerts.some(m => m.id === 'gift-alert')).toBe(true);
  });

  it('gift-alert default configuration is valid', () => {
    const mod = getOverlayModule('gift-alert');
    expect(mod).toBeDefined();
    if (!mod) return;

    const config = mod.defaultConfig;
    expect(config).toBeDefined();
    expect(config.color).toBeDefined();
    expect(config.animation).toBeDefined();
    expect(config.sound).toBeDefined();
    expect(config.font).toBeDefined();
    expect(config.layout).toBeDefined();
    expect(config.appearance).toBeDefined();
    expect(config.showGiftIcon).toBe(true);
    expect(config.showGiftName).toBe(true);
    expect(config.showUsername).toBe(true);
    expect(config.showQuantity).toBe(true);
    expect(config.giftIconSize).toBe(48);
  });

  it('validate function works', () => {
    const mod = getOverlayModule('gift-alert');
    expect(mod).toBeDefined();
    if (!mod) return;

    expect(mod.validate(mod.defaultConfig)).toBe(true);
    expect(mod.validate({})).toBe(false);
    expect(mod.validate(null)).toBe(false);
  });

  it('sanitize function returns valid config', () => {
    const mod = getOverlayModule('gift-alert');
    expect(mod).toBeDefined();
    if (!mod) return;

    const sanitized = mod.sanitize({});
    expect(sanitized).toBeDefined();
    expect(sanitized.showGiftIcon).toBe(true);
    expect(sanitized.giftIconSize).toBe(48);
  });

  it('migrate function works', () => {
    const mod = getOverlayModule('gift-alert');
    expect(mod).toBeDefined();
    if (!mod) return;

    const migrated = mod.migrate(null, 1);
    expect(migrated).toBeDefined();
    expect(migrated.showGiftIcon).toBe(true);
  });

  it('renderer is a React component', () => {
    const mod = getOverlayModule('gift-alert');
    expect(mod).toBeDefined();
    expect(mod?.renderer).toBeDefined();
    expect(typeof mod?.renderer).toBe('function');
  });
});