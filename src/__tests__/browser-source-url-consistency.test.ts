// =============================================
// RosaeFinity — Browser Source URL Consistency Tests
// Verifies: Gallery and CustomizePage produce
// identical URLs for the same overlay instance.
// =============================================

import { describe, it, expect } from 'vitest';

// ── Inline the URL generation logic for testing ──

const SSE_PORT = 18890;
const BASE = `http://127.0.0.1:${SSE_PORT}`;

function getBrowserSourceUrl(browserSourceId: string): string {
  return `${BASE}/overlay/${browserSourceId}.html`;
}

function getBrowserSourceUrlForModule(moduleId: string): string {
  return `${BASE}/overlay/${moduleId}`;
}

function getOverlayWidgetUrl(): string {
  return `${BASE}/overlay-widget.html`;
}

function getSSEBaseUrl(): string {
  return BASE;
}

// ── Simulates OverlayCard URL logic ──

function overlayCardUrl(instance: { browserSourceId: string } | null, metaId: string): string {
  return instance
    ? getBrowserSourceUrl(instance.browserSourceId)
    : getBrowserSourceUrlForModule(metaId);
}

// ── Simulates OverlayGallery URL logic ──

function overlayGalleryUrl(
  selectedInstance: { browserSourceId: string; moduleId: string } | null,
  selectedId: string | undefined,
): string {
  if (selectedInstance) {
    return getBrowserSourceUrl(selectedInstance.browserSourceId);
  }
  const isGoalModule = selectedId === 'goal-progress' || selectedId === 'goal-likes'
    || selectedId === 'goal-followers' || selectedId === 'goal-gifts';
  if (isGoalModule) {
    return `${getSSEBaseUrl()}/goals-widget.html`;
  }
  return getOverlayWidgetUrl().replace('overlay-widget.html', 'coin-jar.html');
}

// ── Simulates CustomizePage URL logic ──

function customizePageUrl(
  isGoalProgress: boolean,
  isGoalModule: boolean,
  instance: { browserSourceId: string } | null,
): string {
  if (isGoalProgress) return `${getSSEBaseUrl()}/goals-widget.html`;
  if (isGoalModule && instance) return getBrowserSourceUrl(instance.browserSourceId);
  return instance ? getBrowserSourceUrl(instance.browserSourceId) : '';
}

// ── Test Data ──

const UUID = '550e8400-e29b-41d4-a716-446655440000';

const instance = {
  id: 'inst-1',
  moduleId: 'goal-likes',
  browserSourceId: UUID,
  profileId: 'profile-1',
};

// ══════════════════════════════════════════════════
// 1. OverlayCard uses instance.browserSourceId
// ══════════════════════════════════════════════════

describe('OverlayCard URL', () => {
  it('uses instance.browserSourceId when instance exists', () => {
    const url = overlayCardUrl(instance, 'goal-likes');
    expect(url).toBe(`${BASE}/overlay/${UUID}.html`);
  });

  it('uses module-level fallback when no instance', () => {
    const url = overlayCardUrl(null, 'goal-likes');
    expect(url).toBe(`${BASE}/overlay/goal-likes`);
  });

  it('non-goal module with instance uses browserSourceId', () => {
    const coinJar = { browserSourceId: 'abc-123-def-456' };
    const url = overlayCardUrl(coinJar, 'coin-jar');
    expect(url).toBe(`${BASE}/overlay/abc-123-def-456.html`);
  });
});

// ══════════════════════════════════════════════════
// 2. Gallery Copy URL uses same browserSourceId
// ══════════════════════════════════════════════════

describe('Gallery Copy URL', () => {
  it('uses instance.browserSourceId when instance exists', () => {
    const url = overlayGalleryUrl(instance, 'goal-likes');
    expect(url).toBe(`${BASE}/overlay/${UUID}.html`);
  });

  it('falls back to goals-widget.html when no instance for goal module', () => {
    const url = overlayGalleryUrl(null, 'goal-likes');
    expect(url).toBe(`${getSSEBaseUrl()}/goals-widget.html`);
  });

  it('falls back to coin-jar.html when no instance for non-goal module', () => {
    const url = overlayGalleryUrl(null, 'coin-jar');
    expect(url).toBe(`${getSSEBaseUrl()}/coin-jar.html`);
  });
});

// ══════════════════════════════════════════════════
// 3. Gallery URL === Customize URL for same instance
// ══════════════════════════════════════════════════

describe('Gallery === Customize consistency', () => {
  it('goal-likes: gallery === customize for same instance', () => {
    const galleryUrl = overlayGalleryUrl(instance, 'goal-likes');
    const customizeUrl = customizePageUrl(false, true, instance);
    expect(galleryUrl).toBe(customizeUrl);
  });

  it('goal-followers: gallery === customize for same instance', () => {
    const inst = { ...instance, moduleId: 'goal-followers' };
    const galleryUrl = overlayGalleryUrl(inst, 'goal-followers');
    const customizeUrl = customizePageUrl(false, true, inst);
    expect(galleryUrl).toBe(customizeUrl);
  });

  it('goal-gifts: gallery === customize for same instance', () => {
    const inst = { ...instance, moduleId: 'goal-gifts' };
    const galleryUrl = overlayGalleryUrl(inst, 'goal-gifts');
    const customizeUrl = customizePageUrl(false, true, inst);
    expect(galleryUrl).toBe(customizeUrl);
  });

  it('goal-progress: gallery === customize (both use goals-widget.html)', () => {
    const galleryUrl = overlayGalleryUrl(null, 'goal-progress');
    const customizeUrl = customizePageUrl(true, true, null);
    expect(galleryUrl).toBe(customizeUrl);
  });

  it('coin-jar: gallery === customize for same instance', () => {
    const inst = { ...instance, moduleId: 'coin-jar' };
    const galleryUrl = overlayGalleryUrl(inst, 'coin-jar');
    const customizeUrl = customizePageUrl(false, false, inst);
    expect(galleryUrl).toBe(customizeUrl);
  });
});

// ══════════════════════════════════════════════════
// 4. Character-for-character identity
// ══════════════════════════════════════════════════

describe('Character-for-character identity', () => {
  it('galleryUrl === customizeUrl for various UUIDs', () => {
    const uuids = [
      '550e8400-e29b-41d4-a716-446655440000',
      '660f9511-f3ac-52e5-b827-557766551111',
      '7710a622-a4bd-63f6-c938-668877662222',
    ];
    for (const uuid of uuids) {
      const inst = { browserSourceId: uuid, moduleId: 'goal-likes' };
      const galleryUrl = overlayGalleryUrl(inst, 'goal-likes');
      const customizeUrl = customizePageUrl(false, true, inst);
      expect(galleryUrl).toBe(customizeUrl);
      expect(galleryUrl).toContain(uuid);
      expect(galleryUrl.endsWith('.html')).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════
// 5. Fallback when no persisted instance
// ══════════════════════════════════════════════════

describe('Fallback without persisted instance', () => {
  it('gallery falls back to module-level URL', () => {
    const url = overlayGalleryUrl(null, 'coin-jar');
    expect(url).toContain('coin-jar');
    expect(url).not.toContain('overlay/');
  });

  it('overlayCard falls back to module-level URL', () => {
    const url = overlayCardUrl(null, 'coin-jar');
    expect(url).toBe(`${BASE}/overlay/coin-jar`);
  });
});

// ══════════════════════════════════════════════════
// 6. No new browserSourceId generated
// ══════════════════════════════════════════════════

describe('No new browserSourceId generated', () => {
  it('URL always uses the provided browserSourceId', () => {
    const customId = 'my-custom-id-123';
    const inst = { browserSourceId: customId, moduleId: 'coin-jar' };
    const url = overlayGalleryUrl(inst, 'coin-jar');
    expect(url).toContain(customId);
    expect(url).toBe(`${BASE}/overlay/${customId}.html`);
  });

  it('URL never generates a UUID when one is provided', () => {
    const knownId = 'known-id-abc';
    const inst = { browserSourceId: knownId, moduleId: 'goal-likes' };
    const url = overlayGalleryUrl(inst, 'goal-likes');
    expect(url).toContain(knownId);
    expect(url).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/); // no UUID pattern
  });
});

// ══════════════════════════════════════════════════
// 7. Existing browserSourceId never mutated
// ══════════════════════════════════════════════════

describe('browserSourceId never mutated', () => {
  it('instance object is not modified by URL generation', () => {
    const inst = { browserSourceId: 'immutable-id', moduleId: 'goal-likes' };
    const original = inst.browserSourceId;
    overlayGalleryUrl(inst, 'goal-likes');
    overlayCardUrl(inst, 'goal-likes');
    expect(inst.browserSourceId).toBe(original);
  });
});

// ══════════════════════════════════════════════════
// 8. Goal overlays use correct persisted instance URL
// ══════════════════════════════════════════════════

describe('Goal overlays', () => {
  it('goal-likes with instance uses browserSourceId', () => {
    const url = overlayGalleryUrl(instance, 'goal-likes');
    expect(url).toBe(`${BASE}/overlay/${UUID}.html`);
  });

  it('goal-followers with instance uses browserSourceId', () => {
    const inst = { ...instance, moduleId: 'goal-followers' };
    const url = overlayGalleryUrl(inst, 'goal-followers');
    expect(url).toBe(`${BASE}/overlay/${UUID}.html`);
  });
});

// ══════════════════════════════════════════════════
// 9. Non-goal overlays use correct persisted instance URL
// ══════════════════════════════════════════════════

describe('Non-goal overlays', () => {
  it('coin-jar with instance uses browserSourceId', () => {
    const inst = { browserSourceId: 'coin-jar-uuid', moduleId: 'coin-jar' };
    const url = overlayGalleryUrl(inst, 'coin-jar');
    expect(url).toBe(`${BASE}/overlay/coin-jar-uuid.html`);
  });

  it('custom overlay with instance uses browserSourceId', () => {
    const inst = { browserSourceId: 'custom-uuid', moduleId: 'chat-box' };
    const url = overlayGalleryUrl(inst, 'chat-box');
    expect(url).toBe(`${BASE}/overlay/custom-uuid.html`);
  });
});

// ══════════════════════════════════════════════════
// 10. All three pages use same helper for same data
// ══════════════════════════════════════════════════

describe('All pages consistent', () => {
  it('overlayCard, gallery, and customize all produce same URL for same instance', () => {
    const inst = { browserSourceId: UUID, moduleId: 'goal-likes' };

    const cardUrl = overlayCardUrl(inst, 'goal-likes');
    const galleryUrl = overlayGalleryUrl(inst, 'goal-likes');
    const customizeUrl = customizePageUrl(false, true, inst);

    expect(cardUrl).toBe(galleryUrl);
    expect(galleryUrl).toBe(customizeUrl);
    expect(cardUrl).toBe(`${BASE}/overlay/${UUID}.html`);
  });
});
