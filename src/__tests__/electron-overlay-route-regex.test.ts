// =============================================
// RosaeFinity — Electron SSE Route Regex Tests
// Verifies: the URL parsing regex in electron/main.cjs
// correctly extracts browserSourceId from overlay URLs,
// stripping the optional .html suffix.
// =============================================

import { describe, it, expect } from 'vitest';

// ── Inline the EXACT regex from electron/main.cjs line 317 ──
// This is the HTML-serving route: /overlay/<browserSourceId>[.html]
const HTML_SERVE_REGEX = /^\/overlay\/([a-z0-9-]+?)(?:\.html)?$/;

// Config endpoint regex: /overlay/<browserSourceId>/config
const CONFIG_REGEX = /^\/overlay\/([a-z0-9-]+)\/config$/;

// SSE events endpoint regex: /overlay/<browserSourceId>/events
const EVENTS_REGEX = /^\/overlay\/([a-z0-9-]+)\/events$/;

// ════════════════════════════════════════════════
// 1. HTML-serving route: strips .html correctly
// ════════════════════════════════════════════════

describe('HTML-serving route regex', () => {
  it('goal-progress.html → goal-progress', () => {
    const m = '/overlay/goal-progress.html'.match(HTML_SERVE_REGEX);
    expect(m?.[1]).toBe('goal-progress');
  });

  it('goal-followers.html → goal-followers', () => {
    const m = '/overlay/goal-followers.html'.match(HTML_SERVE_REGEX);
    expect(m?.[1]).toBe('goal-followers');
  });

  it('goal-gifts.html → goal-gifts', () => {
    const m = '/overlay/goal-gifts.html'.match(HTML_SERVE_REGEX);
    expect(m?.[1]).toBe('goal-gifts');
  });

  it('UUID.html → UUID unchanged', () => {
    const m = '/overlay/550e8400-e29b-41d4-a716-446655440000.html'.match(HTML_SERVE_REGEX);
    expect(m?.[1]).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('goal-progress (no .html) → goal-progress', () => {
    const m = '/overlay/goal-progress'.match(HTML_SERVE_REGEX);
    expect(m?.[1]).toBe('goal-progress');
  });

  it('goal-followers (no .html) → goal-followers', () => {
    const m = '/overlay/goal-followers'.match(HTML_SERVE_REGEX);
    expect(m?.[1]).toBe('goal-followers');
  });

  it('UUID (no .html) → UUID unchanged', () => {
    const m = '/overlay/550e8400-e29b-41d4-a716-446655440000'.match(HTML_SERVE_REGEX);
    expect(m?.[1]).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('coin-jar-pro.html → coin-jar-pro', () => {
    const m = '/overlay/coin-jar-pro.html'.match(HTML_SERVE_REGEX);
    expect(m?.[1]).toBe('coin-jar-pro');
  });

  it('gift-alert.html → gift-alert', () => {
    const m = '/overlay/gift-alert.html'.match(HTML_SERVE_REGEX);
    expect(m?.[1]).toBe('gift-alert');
  });
});

// ════════════════════════════════════════════════
// 2. Config endpoint: browserSourceId from HTML route
//    produces a config URL that matches CONFIG_REGEX
// ════════════════════════════════════════════════

describe('Config endpoint compatibility', () => {
  it('browserSourceId from goal-progress.html matches config regex', () => {
    const htmlMatch = '/overlay/goal-progress.html'.match(HTML_SERVE_REGEX);
    const browserSourceId = htmlMatch?.[1];
    expect(browserSourceId).toBe('goal-progress');

    // BrowserSourceApp constructs: /overlay/${browserSourceId}/config
    const configUrl = `/overlay/${browserSourceId}/config`;
    const configMatch = configUrl.match(CONFIG_REGEX);
    expect(configMatch?.[1]).toBe('goal-progress');
  });

  it('browserSourceId from goal-followers.html matches config regex', () => {
    const htmlMatch = '/overlay/goal-followers.html'.match(HTML_SERVE_REGEX);
    const browserSourceId = htmlMatch?.[1];
    const configUrl = `/overlay/${browserSourceId}/config`;
    const configMatch = configUrl.match(CONFIG_REGEX);
    expect(configMatch?.[1]).toBe('goal-followers');
  });

  it('browserSourceId from goal-gifts.html matches config regex', () => {
    const htmlMatch = '/overlay/goal-gifts.html'.match(HTML_SERVE_REGEX);
    const browserSourceId = htmlMatch?.[1];
    const configUrl = `/overlay/${browserSourceId}/config`;
    const configMatch = configUrl.match(CONFIG_REGEX);
    expect(configMatch?.[1]).toBe('goal-gifts');
  });

  it('UUID browserSourceId matches config regex', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const htmlMatch = `/overlay/${uuid}.html`.match(HTML_SERVE_REGEX);
    const browserSourceId = htmlMatch?.[1];
    expect(browserSourceId).toBe(uuid);
    const configUrl = `/overlay/${browserSourceId}/config`;
    const configMatch = configUrl.match(CONFIG_REGEX);
    expect(configMatch?.[1]).toBe(uuid);
  });

  it('browserSourceId without .html also matches config regex', () => {
    const htmlMatch = '/overlay/goal-progress'.match(HTML_SERVE_REGEX);
    const browserSourceId = htmlMatch?.[1];
    const configUrl = `/overlay/${browserSourceId}/config`;
    const configMatch = configUrl.match(CONFIG_REGEX);
    expect(configMatch?.[1]).toBe('goal-progress');
  });
});

// ════════════════════════════════════════════════
// 3. SSE events endpoint: same pattern
// ════════════════════════════════════════════════

describe('SSE events endpoint compatibility', () => {
  it('browserSourceId from goal-progress.html matches events regex', () => {
    const htmlMatch = '/overlay/goal-progress.html'.match(HTML_SERVE_REGEX);
    const browserSourceId = htmlMatch?.[1];
    const eventsUrl = `/overlay/${browserSourceId}/events`;
    const eventsMatch = eventsUrl.match(EVENTS_REGEX);
    expect(eventsMatch?.[1]).toBe('goal-progress');
  });

  it('UUID browserSourceId matches events regex', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const htmlMatch = `/overlay/${uuid}.html`.match(HTML_SERVE_REGEX);
    const browserSourceId = htmlMatch?.[1];
    const eventsUrl = `/overlay/${browserSourceId}/events`;
    const eventsMatch = eventsUrl.match(EVENTS_REGEX);
    expect(eventsMatch?.[1]).toBe(uuid);
  });
});

// ════════════════════════════════════════════════
// 4. Negative cases
// ════════════════════════════════════════════════

describe('Route regex negative cases', () => {
  it('does not match paths without /overlay/ prefix', () => {
    expect('/events'.match(HTML_SERVE_REGEX)).toBeNull();
    expect('/health'.match(HTML_SERVE_REGEX)).toBeNull();
  });

  it('does not match paths with extra segments', () => {
    expect('/overlay/goal-progress/config'.match(HTML_SERVE_REGEX)).toBeNull();
    expect('/overlay/goal-progress/events'.match(HTML_SERVE_REGEX)).toBeNull();
  });

  it('does not match paths with invalid characters', () => {
    expect('/overlay/goal_progress.html'.match(HTML_SERVE_REGEX)).toBeNull();
    expect('/overlay/goal progress.html'.match(HTML_SERVE_REGEX)).toBeNull();
  });
});
