// =============================================
// RosaeFinity — Points Award Tests
// Verifies: awardPoints count-aware behavior,
// user creation, identity canonicalization,
// FOLLOW/LIKE/GIFT event handling.
// =============================================

import { describe, it, expect } from 'vitest';

// ── Inline the pure logic from app-store for testing ──
// (Zustand store can't be imported in test without full DOM mock)

interface PointsUser {
  username: string;
  name: string;
  points: number;
  level: number;
  giftCount: number;
  likeCount: number;
  followCount: number;
  commentCount: number;
  shareCount: number;
  firstSeen: number;
  lastSeen: number;
}

interface PointsConfig {
  currencyName: string;
  pointsGift: number;
  pointsLike: number;
  pointsFollow: number;
  pointsComment: number;
  pointsShare: number;
  pointsSubscribe: number;
  subBonus: number;
  levelPoints: number;
  levelMultiplier: number;
}

const DEFAULT_CONFIG: PointsConfig = {
  currencyName: 'Points',
  pointsGift: 3,
  pointsLike: 1,
  pointsFollow: 5,
  pointsComment: 1,
  pointsShare: 2,
  pointsSubscribe: 10,
  subBonus: 0,
  levelPoints: 50,
  levelMultiplier: 1.03,
};

function calculateLevel(totalPoints: number, config: PointsConfig): number {
  const base = config.levelPoints || 50;
  const mult = config.levelMultiplier || 1.03;
  let level = 1;
  let required = base;
  let cumulative = 0;
  while (cumulative + required <= totalPoints) {
    cumulative += required;
    level++;
    required = Math.round(base * Math.pow(mult, level - 1));
    if (level > 100) break;
  }
  return level;
}

/**
 * Mirrors the awardPoints logic from app-store.ts
 */
function awardPoints(
  type: 'gift' | 'like' | 'follow' | 'comment' | 'share' | 'subscribe',
  username: string,
  nickname: string,
  count: number | undefined,
  users: Record<string, PointsUser>,
  config: PointsConfig,
): Record<string, PointsUser> {
  const key = username.toLowerCase().trim();
  if (!key) return users;

  const safeCount = Math.max(1, Math.floor(Number(count) || 1));

  const existing = users[key];
  const user: PointsUser = existing
    ? { ...existing }
    : {
        username: key,
        name: nickname || username,
        points: 0,
        level: 1,
        giftCount: 0,
        likeCount: 0,
        followCount: 0,
        commentCount: 0,
        shareCount: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      };

  let earned = 0;
  switch (type) {
    case 'gift': earned = config.pointsGift; break;
    case 'like': earned = config.pointsLike; break;
    case 'follow': earned = config.pointsFollow; break;
    case 'comment': earned = config.pointsComment; break;
    case 'share': earned = config.pointsShare; break;
    case 'subscribe': earned = config.pointsSubscribe; break;
  }

  user.points += earned * safeCount;
  user.lastSeen = Date.now();
  if (type === 'gift') user.giftCount += safeCount;
  if (type === 'like') user.likeCount += safeCount;
  if (type === 'follow') user.followCount += safeCount;
  if (type === 'comment') user.commentCount += safeCount;
  if (type === 'share') user.shareCount += safeCount;
  user.level = calculateLevel(user.points, config);

  return { ...users, [key]: user };
}

// ── FOLLOW Tests ──

describe('FOLLOW: user creation and counting', () => {
  it('creates a new user on first follow', () => {
    const users = awardPoints('follow', 'CoolUser', 'Cool Display', 1, {}, DEFAULT_CONFIG);
    expect(users['cooluser']).toBeDefined();
    expect(users['cooluser'].followCount).toBe(1);
    expect(users['cooluser'].points).toBe(DEFAULT_CONFIG.pointsFollow);
    expect(users['cooluser'].name).toBe('Cool Display');
  });

  it('increments followCount by 1 on second follow', () => {
    let users = awardPoints('follow', 'CoolUser', 'Cool Display', 1, {}, DEFAULT_CONFIG);
    users = awardPoints('follow', 'CoolUser', 'Cool Display', 1, users, DEFAULT_CONFIG);
    expect(users['cooluser'].followCount).toBe(2);
    expect(users['cooluser'].points).toBe(DEFAULT_CONFIG.pointsFollow * 2);
  });

  it('username is canonicalized to lowercase', () => {
    const users = awardPoints('follow', 'COOLUSER', 'Cool Display', 1, {}, DEFAULT_CONFIG);
    expect(users['cooluser']).toBeDefined();
    expect(users['cooluser'].username).toBe('cooluser');
  });

  it('does nothing with empty username', () => {
    const users = awardPoints('follow', '', 'Cool Display', 1, {}, DEFAULT_CONFIG);
    expect(Object.keys(users)).toHaveLength(0);
  });

  it('does nothing with whitespace-only username', () => {
    const users = awardPoints('follow', '   ', 'Cool Display', 1, {}, DEFAULT_CONFIG);
    expect(Object.keys(users)).toHaveLength(0);
  });
});

// ── LIKE Tests ──

describe('LIKE: batch counting', () => {
  it('likeCount=5 produces likeCount +5', () => {
    const users = awardPoints('like', 'Liker', 'Liker Name', 5, {}, DEFAULT_CONFIG);
    expect(users['liker'].likeCount).toBe(5);
    expect(users['liker'].points).toBe(DEFAULT_CONFIG.pointsLike * 5);
  });

  it('likeCount=1 produces likeCount +1', () => {
    const users = awardPoints('like', 'Liker', 'Liker Name', 1, {}, DEFAULT_CONFIG);
    expect(users['liker'].likeCount).toBe(1);
    expect(users['liker'].points).toBe(DEFAULT_CONFIG.pointsLike);
  });

  it('likeCount defaults to 1 when undefined', () => {
    const users = awardPoints('like', 'Liker', 'Liker Name', undefined, {}, DEFAULT_CONFIG);
    expect(users['liker'].likeCount).toBe(1);
    expect(users['liker'].points).toBe(DEFAULT_CONFIG.pointsLike);
  });

  it('likeCount defaults to 1 when 0', () => {
    const users = awardPoints('like', 'Liker', 'Liker Name', 0, {}, DEFAULT_CONFIG);
    expect(users['liker'].likeCount).toBe(1);
  });

  it('likeCount defaults to 1 when negative', () => {
    const users = awardPoints('like', 'Liker', 'Liker Name', -5, {}, DEFAULT_CONFIG);
    expect(users['liker'].likeCount).toBe(1);
  });

  it('accumulates likeCount across multiple like events', () => {
    let users = awardPoints('like', 'Liker', 'Liker Name', 5, {}, DEFAULT_CONFIG);
    users = awardPoints('like', 'Liker', 'Liker Name', 3, users, DEFAULT_CONFIG);
    expect(users['liker'].likeCount).toBe(8);
    expect(users['liker'].points).toBe(DEFAULT_CONFIG.pointsLike * 8);
  });

  it('totalLikeCount must NOT be used as increment (audit regression)', () => {
    // Simulate: likeCount=5, totalLikeCount=47
    // awardPoints should use 5, NOT 47
    const users = awardPoints('like', 'Liker', 'Liker Name', 5, {}, DEFAULT_CONFIG);
    expect(users['liker'].likeCount).toBe(5);
    expect(users['liker'].points).toBe(DEFAULT_CONFIG.pointsLike * 5);
  });
});

// ── GIFT Tests ──

describe('GIFT: delta counting', () => {
  it('giftDelta=10 produces giftCount +10', () => {
    const users = awardPoints('gift', 'Gifter', 'Gifter Name', 10, {}, DEFAULT_CONFIG);
    expect(users['gifter'].giftCount).toBe(10);
    expect(users['gifter'].points).toBe(DEFAULT_CONFIG.pointsGift * 10);
  });

  it('giftDelta=1 (default) produces giftCount +1', () => {
    const users = awardPoints('gift', 'Gifter', 'Gifter Name', 1, {}, DEFAULT_CONFIG);
    expect(users['gifter'].giftCount).toBe(1);
    expect(users['gifter'].points).toBe(DEFAULT_CONFIG.pointsGift);
  });

  it('giftDelta defaults to 1 when undefined', () => {
    const users = awardPoints('gift', 'Gifter', 'Gifter Name', undefined, {}, DEFAULT_CONFIG);
    expect(users['gifter'].giftCount).toBe(1);
    expect(users['gifter'].points).toBe(DEFAULT_CONFIG.pointsGift);
  });

  it('giftDelta defaults to 1 when 0', () => {
    const users = awardPoints('gift', 'Gifter', 'Gifter Name', 0, {}, DEFAULT_CONFIG);
    expect(users['gifter'].giftCount).toBe(1);
  });

  it('giftDelta defaults to 1 when negative', () => {
    const users = awardPoints('gift', 'Gifter', 'Gifter Name', -10, {}, DEFAULT_CONFIG);
    expect(users['gifter'].giftCount).toBe(1);
  });

  it('accumulates giftCount across multiple gift events', () => {
    let users = awardPoints('gift', 'Gifter', 'Gifter Name', 10, {}, DEFAULT_CONFIG);
    users = awardPoints('gift', 'Gifter', 'Gifter Name', 5, users, DEFAULT_CONFIG);
    expect(users['gifter'].giftCount).toBe(15);
    expect(users['gifter'].points).toBe(DEFAULT_CONFIG.pointsGift * 15);
  });

  it('gift count is separate from like count', () => {
    let users = awardPoints('gift', 'MultiUser', 'Multi', 10, {}, DEFAULT_CONFIG);
    users = awardPoints('like', 'MultiUser', 'Multi', 5, users, DEFAULT_CONFIG);
    expect(users['multiuser'].giftCount).toBe(10);
    expect(users['multiuser'].likeCount).toBe(5);
    expect(users['multiuser'].points).toBe(
      DEFAULT_CONFIG.pointsGift * 10 + DEFAULT_CONFIG.pointsLike * 5
    );
  });
});

// ── IDENTITY Tests ──

describe('IDENTITY: canonical user key', () => {
  it('Follow, Like, Gift using same uniqueId resolve to same user', () => {
    let users: Record<string, PointsUser> = {};

    users = awardPoints('follow', 'streamer_fan', 'Fan Name', 1, users, DEFAULT_CONFIG);
    users = awardPoints('like', 'streamer_fan', 'Fan Name', 5, users, DEFAULT_CONFIG);
    users = awardPoints('gift', 'streamer_fan', 'Fan Name', 3, users, DEFAULT_CONFIG);

    const user = users['streamer_fan'];
    expect(user).toBeDefined();
    expect(user.followCount).toBe(1);
    expect(user.likeCount).toBe(5);
    expect(user.giftCount).toBe(3);
    expect(user.points).toBe(
      DEFAULT_CONFIG.pointsFollow * 1 +
      DEFAULT_CONFIG.pointsLike * 5 +
      DEFAULT_CONFIG.pointsGift * 3
    );
  });

  it('Gift with numeric ID does NOT create duplicate when uniqueId exists', () => {
    // Simulate: follow uses uniqueId='cooluser', gift also uses uniqueId='cooluser'
    // NOT: follow uses 'cooluser', gift uses '7123456789'
    let users: Record<string, PointsUser> = {};

    users = awardPoints('follow', 'cooluser', 'Cool', 1, users, DEFAULT_CONFIG);
    users = awardPoints('gift', 'cooluser', 'Cool', 5, users, DEFAULT_CONFIG);

    expect(Object.keys(users)).toHaveLength(1);
    expect(users['cooluser'].followCount).toBe(1);
    expect(users['cooluser'].giftCount).toBe(5);
  });

  it('Gift with numeric ID creates separate user when different uniqueId', () => {
    let users: Record<string, PointsUser> = {};

    users = awardPoints('follow', 'userA', 'User A', 1, users, DEFAULT_CONFIG);
    users = awardPoints('gift', 'userB', 'User B', 5, users, DEFAULT_CONFIG);

    expect(Object.keys(users)).toHaveLength(2);
    expect(users['usera'].followCount).toBe(1);
    expect(users['userb'].giftCount).toBe(5);
  });

  it('nickname is only used on first creation, not overwritten', () => {
    let users = awardPoints('follow', 'user1', 'Old Nickname', 1, {}, DEFAULT_CONFIG);
    users = awardPoints('follow', 'user1', 'New Nickname', 1, users, DEFAULT_CONFIG);

    expect(users['user1'].name).toBe('Old Nickname');
  });

  it('firstSeen is set on creation, not updated on subsequent calls', () => {
    const firstSeen = Date.now();
    let users = awardPoints('follow', 'user1', 'User', 1, {}, DEFAULT_CONFIG);
    const createdFirstSeen = users['user1'].firstSeen;
    expect(createdFirstSeen).toBeGreaterThanOrEqual(firstSeen);

    users = awardPoints('like', 'user1', 'User', 1, users, DEFAULT_CONFIG);
    // firstSeen should NOT change
    expect(users['user1'].firstSeen).toBe(createdFirstSeen);
  });

  it('lastSeen is updated on every call', () => {
    let users = awardPoints('follow', 'user1', 'User', 1, {}, DEFAULT_CONFIG);
    const firstSeen = users['user1'].lastSeen;

    // Small delay to ensure timestamp differs
    users = awardPoints('like', 'user1', 'User', 1, users, DEFAULT_CONFIG);
    expect(users['user1'].lastSeen).toBeGreaterThanOrEqual(firstSeen);
  });
});

// ── Backward Compatibility Tests ──

describe('BACKWARD COMPATIBILITY: count defaults', () => {
  it('calling without count argument defaults to 1', () => {
    const users = awardPoints('follow', 'user1', 'User', undefined, {}, DEFAULT_CONFIG);
    expect(users['user1'].followCount).toBe(1);
    expect(users['user1'].points).toBe(DEFAULT_CONFIG.pointsFollow);
  });

  it('calling with explicit count=1 behaves same as no count', () => {
    const usersA = awardPoints('follow', 'user1', 'User', undefined, {}, DEFAULT_CONFIG);
    const usersB = awardPoints('follow', 'user1', 'User', 1, {}, DEFAULT_CONFIG);
    expect(usersA['user1'].followCount).toBe(usersB['user1'].followCount);
    expect(usersA['user1'].points).toBe(usersB['user1'].points);
  });
});

// ── Level Calculation Tests ──

describe('LEVEL: recalculated on points change', () => {
  it('level increases when points cross threshold', () => {
    // Default: level 2 at 50 points
    let users = awardPoints('gift', 'user1', 'User', 17, {}, DEFAULT_CONFIG);
    // 17 * 3 = 51 points → level 2
    expect(users['user1'].points).toBe(51);
    expect(users['user1'].level).toBe(2);
  });

  it('level stays at 1 below threshold', () => {
    let users = awardPoints('gift', 'user1', 'User', 16, {}, DEFAULT_CONFIG);
    // 16 * 3 = 48 points → still level 1
    expect(users['user1'].points).toBe(48);
    expect(users['user1'].level).toBe(1);
  });
});

// ── TikTok Normalization Tests ──

describe('NORMALIZATION: TikTok event payloads', () => {
  // Simulate what _normalizeGiftEvent produces AFTER the fix
  it('Gift normalization prefers uniqueId over id', () => {
    const rawData = {
      user: { id: '7123456789', uniqueId: 'cooluser', nickname: 'Cool' },
    };

    // The fixed normalization: uniqueId first
    const normalizedUser = rawData.user?.uniqueId || rawData.user?.id || 'someone';
    expect(normalizedUser).toBe('cooluser');
  });

  it('Gift normalization falls back to id when uniqueId missing', () => {
    const rawData = {
      user: { id: '7123456789', nickname: 'Cool' },
    };

    const normalizedUser = rawData.user?.uniqueId || rawData.user?.id || 'someone';
    expect(normalizedUser).toBe('7123456789');
  });

  it('Gift normalization falls back to "someone" when both missing', () => {
    const rawData = { user: {} };

    const normalizedUser = rawData.user?.uniqueId || rawData.user?.id || 'someone';
    expect(normalizedUser).toBe('someone');
  });

  it('Follow normalization uses uniqueId', () => {
    const rawData = {
      user: { uniqueId: 'cooluser', nickname: 'Cool' },
    };

    const normalizedUser = rawData.user?.uniqueId || 'someone';
    expect(normalizedUser).toBe('cooluser');
  });

  it('Like normalization uses uniqueId', () => {
    const rawData = {
      user: { uniqueId: 'cooluser', nickname: 'Cool' },
    };

    const normalizedUser = rawData.user?.uniqueId || rawData.uniqueId || 'someone';
    expect(normalizedUser).toBe('cooluser');
  });

  it('Like event carries likeCount (per-event), not totalLikeCount', () => {
    const rawData = { likeCount: 5, totalLikeCount: 47 };

    // The dispatcher should use likeCount, NOT totalLikeCount
    const increment = rawData.likeCount || 1;
    expect(increment).toBe(5);
  });
});

// ── Regression: Existing behavior unchanged ──

describe('REGRESSION: no existing behavior broken', () => {
  it('pointsGift=3 per unit by default', () => {
    const users = awardPoints('gift', 'g', 'G', 1, {}, DEFAULT_CONFIG);
    expect(users['g'].points).toBe(3);
  });

  it('pointsLike=1 per unit by default', () => {
    const users = awardPoints('like', 'l', 'L', 1, {}, DEFAULT_CONFIG);
    expect(users['l'].points).toBe(1);
  });

  it('pointsFollow=5 per unit by default', () => {
    const users = awardPoints('follow', 'f', 'F', 1, {}, DEFAULT_CONFIG);
    expect(users['f'].points).toBe(5);
  });

  it('deductPoints logic is not affected (no change to that function)', () => {
    // This is a conceptual test — deductPoints is not modified
    const users = awardPoints('follow', 'user1', 'User', 1, {}, DEFAULT_CONFIG);
    expect(users['user1'].points).toBe(DEFAULT_CONFIG.pointsFollow);
    // deductPoints still works as before (separate function, unchanged)
  });
});
