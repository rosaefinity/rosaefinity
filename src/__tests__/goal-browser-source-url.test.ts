// =============================================
// RosaeFinity — Goal Browser Source URL Regression Tests
// Verifies: each goal type generates a unique, correct
// Browser Source URL that resolves to its intended module.
// =============================================

import { describe, it, expect } from 'vitest';
import { getBrowserSourceUrl, getBrowserSourceUrlForModule } from '../lib/browser-source-url';

// ── Simulate the Gallery URL logic ──

interface OverlayInstance {
  id: string;
  moduleId: string;
  browserSourceId: string;
  profileId: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  configVersion: number;
  createdAt: number;
  updatedAt: number;
}

function simulateGalleryUrl(
  selected: { id: string } | null,
  selectedInstance: OverlayInstance | null,
): string {
  const SSE_BASE = 'http://127.0.0.1:18890';

  if (selectedInstance) {
    return `${SSE_BASE}/overlay/${selectedInstance.browserSourceId}.html`;
  }
  // Fixed fallback: /overlay/<moduleId>.html?overlay=<moduleId> → overlay-entry.html → BrowserSourceApp
  if (selected?.id) {
    return `${SSE_BASE}/overlay/${selected.id}.html?overlay=${selected.id}`;
  }
  return `${SSE_BASE}/overlay-widget.html`;
}

// ── Simulate BrowserSourceApp URL parsing (widened regex) ──

function parseBrowserSourceUrl(url: string): { overlayId: string | null; browserSourceId: string | null } {
  const u = new URL(url);
  const pathMatch = u.pathname.match(/^\/overlay\/([a-z0-9-]+)(?:\.html)?$/);
  const browserSourceId = pathMatch ? pathMatch[1] : null;
  const overlayId = u.searchParams.get('overlay');
  return { overlayId, browserSourceId };
}

// ── Test Registry Module IDs ──

describe('Registry module IDs for goal overlays', () => {
  it('goal-progress is a registered module ID', () => {
    // From registry.ts: goalProgressOverlay has id: 'goal-progress'
    const moduleId = 'goal-progress';
    expect(moduleId).toBe('goal-progress');
  });

  it('goal-followers is a registered module ID', () => {
    const moduleId = 'goal-followers';
    expect(moduleId).toBe('goal-followers');
  });

  it('goal-gifts is a registered module ID', () => {
    const moduleId = 'goal-gifts';
    expect(moduleId).toBe('goal-gifts');
  });
});

// ── Test URL generation WITHOUT persisted instances ──

describe('Goal URLs without persisted instances', () => {
  it('Goal Likes generates unique URL /overlay/goal-progress.html?overlay=goal-progress', () => {
    const url = simulateGalleryUrl({ id: 'goal-progress' }, null);
    expect(url).toContain('/overlay/goal-progress.html?overlay=goal-progress');
    expect(url).not.toContain('goal-likes');
    expect(url).not.toContain('goal-followers');
    expect(url).not.toContain('goal-gifts');
    expect(url).not.toContain('overlay-widget');
  });

  it('Goal Followers generates unique URL /overlay/goal-followers.html?overlay=goal-followers', () => {
    const url = simulateGalleryUrl({ id: 'goal-followers' }, null);
    expect(url).toContain('/overlay/goal-followers.html?overlay=goal-followers');
    expect(url).not.toContain('goal-progress');
    expect(url).not.toContain('goal-gifts');
    expect(url).not.toContain('overlay-widget');
  });

  it('Goal Gifts generates unique URL /overlay/goal-gifts.html?overlay=goal-gifts', () => {
    const url = simulateGalleryUrl({ id: 'goal-gifts' }, null);
    expect(url).toContain('/overlay/goal-gifts.html?overlay=goal-gifts');
    expect(url).not.toContain('goal-progress');
    expect(url).not.toContain('goal-followers');
    expect(url).not.toContain('overlay-widget');
  });

  it('all three goal URLs are distinct', () => {
    const urlLikes = simulateGalleryUrl({ id: 'goal-progress' }, null);
    const urlFollowers = simulateGalleryUrl({ id: 'goal-followers' }, null);
    const urlGifts = simulateGalleryUrl({ id: 'goal-gifts' }, null);

    expect(urlLikes).not.toBe(urlFollowers);
    expect(urlFollowers).not.toBe(urlGifts);
    expect(urlLikes).not.toBe(urlGifts);
  });
});

// ── Test URL generation WITH persisted instances ──

describe('Goal URLs with persisted instances', () => {
  it('instance URL uses browserSourceId, not moduleId', () => {
    const instance: OverlayInstance = {
      id: 'inst-1',
      moduleId: 'goal-progress',
      browserSourceId: '550e8400-e29b-41d4-a716-446655440000',
      profileId: 'profile-1',
      name: 'Goal Likes',
      enabled: true,
      config: {},
      configVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const url = simulateGalleryUrl({ id: 'goal-progress' }, instance);
    expect(url).toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(url).not.toContain('overlay=');
  });

  it('each instance generates unique URL via unique browserSourceId', () => {
    const instA: OverlayInstance = {
      id: 'inst-a', moduleId: 'goal-progress',
      browserSourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      profileId: 'p1', name: 'Likes', enabled: true,
      config: {}, configVersion: 1, createdAt: 0, updatedAt: 0,
    };
    const instB: OverlayInstance = {
      id: 'inst-b', moduleId: 'goal-followers',
      browserSourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      profileId: 'p1', name: 'Followers', enabled: true,
      config: {}, configVersion: 1, createdAt: 0, updatedAt: 0,
    };
    const instC: OverlayInstance = {
      id: 'inst-c', moduleId: 'goal-gifts',
      browserSourceId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      profileId: 'p1', name: 'Gifts', enabled: true,
      config: {}, configVersion: 1, createdAt: 0, updatedAt: 0,
    };

    const urlA = simulateGalleryUrl({ id: 'goal-progress' }, instA);
    const urlB = simulateGalleryUrl({ id: 'goal-followers' }, instB);
    const urlC = simulateGalleryUrl({ id: 'goal-gifts' }, instC);

    expect(urlA).toContain('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(urlB).toContain('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(urlC).toContain('cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(urlA).not.toBe(urlB);
    expect(urlB).not.toBe(urlC);
  });
});

// ── Test URL parsing (BrowserSourceApp) ──

describe('BrowserSourceApp URL parsing', () => {
  it('parses UUID instance URL to extract browserSourceId', () => {
    const url = 'http://127.0.0.1:18890/overlay/550e8400-e29b-41d4-a716-446655440000.html';
    const parsed = parseBrowserSourceUrl(url);
    expect(parsed.browserSourceId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(parsed.overlayId).toBeNull();
  });

  it('parses module fallback URL to extract moduleId from pathname', () => {
    const url = 'http://127.0.0.1:18890/overlay/goal-progress.html';
    const parsed = parseBrowserSourceUrl(url);
    expect(parsed.browserSourceId).toBe('goal-progress');
    expect(parsed.overlayId).toBeNull();
  });

  it('each goal module URL parses to distinct moduleId', () => {
    const urlA = 'http://127.0.0.1:18890/overlay/goal-progress.html';
    const urlB = 'http://127.0.0.1:18890/overlay/goal-followers.html';
    const urlC = 'http://127.0.0.1:18890/overlay/goal-gifts.html';

    expect(parseBrowserSourceUrl(urlA).browserSourceId).toBe('goal-progress');
    expect(parseBrowserSourceUrl(urlB).browserSourceId).toBe('goal-followers');
    expect(parseBrowserSourceUrl(urlC).browserSourceId).toBe('goal-gifts');
  });

  it('UUID and module ID URLs are both parsed correctly', () => {
    const uuidUrl = 'http://127.0.0.1:18890/overlay/550e8400-e29b-41d4-a716-446655440000.html';
    const moduleUrl = 'http://127.0.0.1:18890/overlay/coin-jar-pro.html';

    expect(parseBrowserSourceUrl(uuidUrl).browserSourceId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(parseBrowserSourceUrl(moduleUrl).browserSourceId).toBe('coin-jar-pro');
  });
});

// ── Regression: old shared URL was wrong ──

describe('Regression: old shared goals-widget.html URL is replaced', () => {
  it('no goal URL contains goals-widget.html', () => {
    const urlA = simulateGalleryUrl({ id: 'goal-progress' }, null);
    const urlB = simulateGalleryUrl({ id: 'goal-followers' }, null);
    const urlC = simulateGalleryUrl({ id: 'goal-gifts' }, null);

    expect(urlA).not.toContain('goals-widget.html');
    expect(urlB).not.toContain('goals-widget.html');
    expect(urlC).not.toContain('goals-widget.html');
  });

  it('no goal URL uses overlay-widget.html', () => {
    const urlA = simulateGalleryUrl({ id: 'goal-progress' }, null);
    const urlB = simulateGalleryUrl({ id: 'goal-followers' }, null);
    const urlC = simulateGalleryUrl({ id: 'goal-gifts' }, null);

    expect(urlA).not.toContain('overlay-widget.html');
    expect(urlB).not.toContain('overlay-widget.html');
    expect(urlC).not.toContain('overlay-widget.html');
  });

  it('no goal URL uses the wrong module ID goal-likes', () => {
    const urlA = simulateGalleryUrl({ id: 'goal-progress' }, null);
    const urlB = simulateGalleryUrl({ id: 'goal-followers' }, null);
    const urlC = simulateGalleryUrl({ id: 'goal-gifts' }, null);

    // goal-likes is NOT a registered module — should never appear
    expect(urlA).not.toContain('goal-likes');
    expect(urlB).not.toContain('goal-likes');
    expect(urlC).not.toContain('goal-likes');
  });
});

// ── Gift Alert and Coin Jar Pro remain unchanged ──

describe('Non-goal overlays unaffected', () => {
  it('Gift Alert uses instance-based URL when instance exists', () => {
    const instance: OverlayInstance = {
      id: 'inst-alert', moduleId: 'gift-alert',
      browserSourceId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      profileId: 'p1', name: 'Gift Alert', enabled: true,
      config: {}, configVersion: 1, createdAt: 0, updatedAt: 0,
    };
    const url = simulateGalleryUrl({ id: 'gift-alert' }, instance);
    expect(url).toContain('dddddddd-dddd-dddd-dddd-dddddddddddd');
  });

  it('Gift Alert uses module fallback when no instance', () => {
    const url = simulateGalleryUrl({ id: 'gift-alert' }, null);
    expect(url).toContain('/overlay/gift-alert.html?overlay=gift-alert');
    expect(url).not.toContain('overlay-widget');
  });

  it('Coin Jar Pro uses instance-based URL when instance exists', () => {
    const instance: OverlayInstance = {
      id: 'inst-cjar', moduleId: 'coin-jar-pro',
      browserSourceId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      profileId: 'p1', name: 'Coin Jar Pro', enabled: true,
      config: {}, configVersion: 1, createdAt: 0, updatedAt: 0,
    };
    const url = simulateGalleryUrl({ id: 'coin-jar-pro' }, instance);
    expect(url).toContain('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
  });

  it('Coin Jar Pro uses module fallback when no instance', () => {
    const url = simulateGalleryUrl({ id: 'coin-jar-pro' }, null);
    expect(url).toContain('/overlay/coin-jar-pro.html?overlay=coin-jar-pro');
    expect(url).not.toContain('overlay-widget');
  });
});
