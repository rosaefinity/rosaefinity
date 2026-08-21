// ─────────────────────────────────────────────────────
// Coin Jar Pro Registry Integration Tests
// ─────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { getOverlayModule, getOverlayModules, getOverlaysByCategory, hasOverlay, loadModule } from '../registry';
import { coinJarProOverlay } from '../coin-jar-pro';

describe('Coin Jar Pro Registry Integration', () => {
  it('should be registered in the global registry', () => {
    const allModules = getOverlayModules();
    const coinJarPro = allModules.find(m => m.id === 'coin-jar-pro');
    expect(coinJarPro).toBeDefined();
    expect(coinJarPro?.id).toBe('coin-jar-pro');
    expect(coinJarPro?.name).toBe('Coin Jar Pro');
    expect(coinJarPro?.category).toBe('goals');
  });

  it('should be loadable by ID', () => {
    const module = getOverlayModule('coin-jar-pro');
    expect(module).toBeDefined();
    expect(module?.id).toBe('coin-jar-pro');
  });

  it('should be in the goals category', () => {
    const goalsModules = getOverlaysByCategory('goals');
    const coinJarPro = goalsModules.find(m => m.id === 'coin-jar-pro');
    expect(coinJarPro).toBeDefined();
  });

  it('should return true for hasOverlay', () => {
    expect(hasOverlay('coin-jar-pro')).toBe(true);
  });

  it('should load asynchronously', async () => {
    const module = await loadModule('coin-jar-pro');
    expect(module).toBeDefined();
    expect(module?.id).toBe('coin-jar-pro');
  });

  it('should have valid module structure', () => {
    const module = getOverlayModule('coin-jar-pro')!;
    expect(module.id).toBe('coin-jar-pro');
    expect(module.name).toBe('Coin Jar Pro');
    expect(module.description).toContain('jar fill up');
    expect(module.category).toBe('goals');
    expect(module.icon).toBeDefined();
    expect(Array.isArray(module.tags)).toBe(true);
    expect(module.tags).toContain('gift');
    expect(module.tags).toContain('goal');
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

  it('should have correct default config', () => {
    const module = getOverlayModule('coin-jar-pro')!;
    const config = module.defaultConfig;
    expect(config.goalCoins).toBe(1000);
    expect(config.showGoal).toBe(true);
    expect(config.showTotalCoins).toBe(true);
    expect(config.showDonorNotification).toBe(true);
    expect(config.jarScale).toBe(1);
    expect(config.notificationPosition).toBe('bottom');
    expect(config.fillStyle).toBe('gradient');
    expect(config.giftAnimation).toBe('drop');
    expect(config.animationDuration).toBe(800);
    expect(config.particleAmount).toBe(8);
    expect(config.notificationDuration).toBe(3000);
    expect(config.continueAfterGoal).toBe(false);
  });

  it('should validate config correctly', () => {
    const module = getOverlayModule('coin-jar-pro')!;
    expect(module.validate(module.defaultConfig)).toBe(true);
    expect(module.validate({})).toBe(false);
    expect(module.validate(null)).toBe(false);
  });

  it('should sanitize config correctly', () => {
    const module = getOverlayModule('coin-jar-pro')!;
    const sanitized = module.sanitize({ goalCoins: 5000 });
    expect(sanitized.goalCoins).toBe(5000);
    expect(sanitized.showGoal).toBe(true); // default
  });

  it('should migrate config correctly', () => {
    const module = getOverlayModule('coin-jar-pro')!;
    const migrated = module.migrate({ goalCoins: 2000 }, 1);
    expect(migrated.goalCoins).toBe(2000);
  });
});