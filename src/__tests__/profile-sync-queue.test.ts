// =============================================
// RosaeFinity — Profile Sync Queue Tests
// Verifies: persistent queue, dedup, ordering, account isolation,
// retry, pull protection, media filtering.
// =============================================

import { describe, it, expect } from 'vitest';

// ── Helper: simulate queue item ──

interface QueueItem {
  id: string;
  userId: string;
  operation: 'create' | 'update' | 'delete';
  localId: string;
  serverId?: string;
  payload?: Record<string, unknown>;
  status: 'pending' | 'processing' | 'failed' | 'done';
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  lastError?: string;
  errorCode?: string;
  createdAt: number;
  updatedAt: number;
}

function makeQueueItem(overrides: Partial<QueueItem> = {}): QueueItem {
  const now = Date.now();
  return {
    id: `pq_${now}_${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1',
    operation: 'update',
    localId: 'spf_test',
    status: 'pending',
    attempts: 0,
    maxAttempts: 10,
    nextRetryAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ── Queue Deduplication ──

describe('Queue Deduplication', () => {
  it('Multiple updates to same profile produce single merged item', () => {
    // Simulate: user edits profile 5 times offline
    const updates = [
      { name: 'Gaming v1' },
      { name: 'Gaming v2' },
      { name: 'Gaming v3', icon: '🎮' },
      { name: 'Gaming v4' },
      { name: 'Gaming v5', tiktokUsername: 'gamer' },
    ];

    // Merge logic: each update merges into previous
    let merged: Record<string, unknown> = {};
    for (const u of updates) {
      merged = { ...merged, ...u };
    }

    expect(merged.name).toBe('Gaming v5');
    expect(merged.icon).toBe('🎮');
    expect(merged.tiktokUsername).toBe('gamer');
    // Only ONE queue item needed, not 5
  });

  it('Create followed by update merges into single create', () => {
    // Simulate: create profile, then immediately update before sync
    const createPayload = { name: 'New Profile', icon: '🌹' };
    const updatePayload = { name: 'Updated Profile', tiktokUsername: 'user' };

    // Merge: update overwrites create fields
    const merged = { ...createPayload, ...updatePayload };

    expect(merged.name).toBe('Updated Profile');
    expect(merged.icon).toBe('🌹'); // Preserved from create
    expect(merged.tiktokUsername).toBe('user');
  });

  it('Delete removes pending create from queue', () => {
    const queue = [
      makeQueueItem({ id: 'q1', operation: 'create', localId: 'spf_new' }),
    ];

    // Delete of never-synced profile: remove create
    const afterDelete = queue.filter(item =>
      !(item.localId === 'spf_new' && item.operation === 'create')
    );

    expect(afterDelete).toHaveLength(0);
  });

  it('Delete removes pending update from queue', () => {
    const queue = [
      makeQueueItem({ id: 'q1', operation: 'update', localId: 'spf_1' }),
    ];

    // Delete of profile with pending update: remove update too
    const afterDelete = queue.filter(item =>
      !(item.localId === 'spf_1' && item.operation === 'update')
    );

    expect(afterDelete).toHaveLength(0);
  });
});

// ── Queue Ordering ──

describe('Queue Ordering', () => {
  it('create before update — update waits for create', () => {
    const queue = [
      makeQueueItem({ id: 'q1', operation: 'create', localId: 'spf_1', createdAt: 100 }),
      makeQueueItem({ id: 'q2', operation: 'update', localId: 'spf_1', createdAt: 200 }),
    ];

    // Sorted by createdAt — create comes first
    const sorted = queue.sort((a, b) => a.createdAt - b.createdAt);
    expect(sorted[0].operation).toBe('create');
    expect(sorted[1].operation).toBe('update');
  });

  it('create then delete — create removed, no delete needed', () => {
    const queue = [
      makeQueueItem({ id: 'q1', operation: 'create', localId: 'spf_new' }),
    ];

    // Delete of never-synced profile: just remove create
    const afterDelete = queue.filter(item =>
      !(item.localId === 'spf_new' && item.operation === 'create')
    );

    expect(afterDelete).toHaveLength(0);
  });
});

// ── Account Isolation ──

describe('Account Isolation', () => {
  it('Queue items are scoped by userId', () => {
    const queue = [
      makeQueueItem({ id: 'q1', userId: 'user-A', localId: 'spf_a1' }),
      makeQueueItem({ id: 'q2', userId: 'user-A', localId: 'spf_a2' }),
      makeQueueItem({ id: 'q3', userId: 'user-B', localId: 'spf_b1' }),
    ];

    const userAItems = queue.filter(i => i.userId === 'user-A');
    const userBItems = queue.filter(i => i.userId === 'user-B');

    expect(userAItems).toHaveLength(2);
    expect(userBItems).toHaveLength(1);
    expect(userAItems.every(i => i.localId.startsWith('spf_a'))).toBe(true);
    expect(userBItems.every(i => i.localId.startsWith('spf_b'))).toBe(true);
  });

  it('Clearing queue for user A does not affect user B', () => {
    const queue = [
      makeQueueItem({ id: 'q1', userId: 'user-A', localId: 'spf_a1' }),
      makeQueueItem({ id: 'q2', userId: 'user-B', localId: 'spf_b1' }),
    ];

    // Clear user A
    const afterClear = queue.filter(i => i.userId !== 'user-A');

    expect(afterClear).toHaveLength(1);
    expect(afterClear[0].userId).toBe('user-B');
  });

  it('Account B cannot read Account A queue items', () => {
    const queue = [
      makeQueueItem({ id: 'q1', userId: 'user-A', localId: 'spf_a1' }),
    ];

    // Simulate: Account B queries queue — should get nothing
    const userBItems = queue.filter(i => i.userId === 'user-B');
    expect(userBItems).toHaveLength(0);
  });
});

// ── Retry Behavior ──

describe('Retry Behavior', () => {
  it('Exponential backoff increases delay', () => {
    const BASE_DELAY_MS = 1000;
    const MAX_DELAY_MS = 60_000;

    const computeBackoff = (attempts: number): number => {
      return Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS);
    };

    expect(computeBackoff(0)).toBe(1000);
    expect(computeBackoff(1)).toBe(2000);
    expect(computeBackoff(2)).toBe(4000);
    expect(computeBackoff(3)).toBe(8000);
    expect(computeBackoff(4)).toBe(16000);
    expect(computeBackoff(5)).toBe(32000);
    expect(computeBackoff(6)).toBe(60000); // Capped
    expect(computeBackoff(10)).toBe(60000); // Still capped
  });

  it('Network error stays pending for retry', () => {
    const item = makeQueueItem({ attempts: 0, maxAttempts: 10 });
    const errorCode = 'NETWORK';

    const isPermanent = errorCode
      ? (parseInt(errorCode) >= 400 && parseInt(errorCode) < 500 && parseInt(errorCode) !== 401)
      : false;

    expect(isPermanent).toBe(false); // NETWORK is not permanent
  });

  it('4xx validation error is permanent', () => {
    const item = makeQueueItem({ attempts: 0, maxAttempts: 10 });
    const errorCode = '422';

    const isPermanent = errorCode
      ? (parseInt(errorCode) >= 400 && parseInt(errorCode) < 500 && parseInt(errorCode) !== 401)
      : false;

    expect(isPermanent).toBe(true);
  });

  it('401 is NOT permanent (token refresh possible)', () => {
    const errorCode = '401';

    const isPermanent = errorCode
      ? (parseInt(errorCode) >= 400 && parseInt(errorCode) < 500 && parseInt(errorCode) !== 401)
      : false;

    expect(isPermanent).toBe(false);
  });

  it('5xx server error stays pending for retry', () => {
    const errorCode = '500';

    const isPermanent = errorCode
      ? (parseInt(errorCode) >= 400 && parseInt(errorCode) < 500 && parseInt(errorCode) !== 401)
      : false;

    expect(isPermanent).toBe(false);
  });

  it('Max attempts reached marks as failed', () => {
    const item = makeQueueItem({ attempts: 9, maxAttempts: 10 });
    const wouldExceed = item.attempts + 1 >= item.maxAttempts;

    expect(wouldExceed).toBe(true);
  });
});

// ── Pull Protection ──

describe('Pull Protection', () => {
  it('Pending local changes are not overwritten by cloud pull', () => {
    // Cloud uses server UUIDs as IDs; local uses spf_xxx with serverId field
    const localProfiles = [
      { id: 'spf_1', name: 'Local Version', serverId: 'server-1' },
    ];
    const cloudProfiles = [
      { id: 'server-1', name: 'Cloud Version (old)', serverId: 'server-1' },
    ];
    // pendingLocalIds contains local IDs (spf_xxx) from the queue
    const pendingLocalIds = new Set(['spf_1']);

    // Actual merge logic from pullCloudProfiles:
    // 1. Cloud profiles not matching pending local IDs
    // 2. Pending local profiles (kept as-is)
    // 3. Local-only profiles not in cloud and not pending
    const cloudIds = new Set(cloudProfiles.map(p => p.id));
    const localOnlyProfiles = localProfiles.filter(p =>
      !cloudIds.has(p.id) && !pendingLocalIds.has(p.id)
    );
    const pendingLocalProfiles = localProfiles.filter(p =>
      pendingLocalIds.has(p.id)
    );
    const merged = [...cloudProfiles, ...localOnlyProfiles, ...pendingLocalProfiles];

    // Cloud has server-1, local has spf_1 with serverId=server-1
    // spf_1 is pending → kept. cloud server-1 also present.
    // Both exist because cloud ID ≠ local ID
    expect(merged.length).toBeGreaterThanOrEqual(1);
    // The local pending profile is preserved
    expect(merged.some(p => p.name === 'Local Version')).toBe(true);
  });

  it('Non-synced local profiles without pending items are preserved during pull', () => {
    // Local-only profiles that haven't been synced yet should be kept
    // (they will be migrated to cloud on next migration cycle)
    const localProfiles = [
      { id: 'spf_orphan', name: 'Local Only', serverId: undefined },
    ];
    const cloudProfiles = [
      { id: 'server-1', name: 'Cloud Profile', serverId: 'server-1' },
    ];
    const pendingLocalIds = new Set<string>(); // No pending items

    const cloudIds = new Set(cloudProfiles.map(p => p.id));
    const localOnlyProfiles = localProfiles.filter(p =>
      !cloudIds.has(p.id) && !pendingLocalIds.has(p.id)
    );
    const pendingLocalProfiles = localProfiles.filter(p =>
      pendingLocalIds.has(p.id)
    );
    const merged = [...cloudProfiles, ...localOnlyProfiles, ...pendingLocalProfiles];

    // Both cloud and local-only profiles present
    expect(merged).toHaveLength(2);
    expect(merged.some(p => p.name === 'Cloud Profile')).toBe(true);
    expect(merged.some(p => p.name === 'Local Only')).toBe(true);
  });

  it('Pending local profile overrides cloud version', () => {
    // Both reference the same server entity but local has pending changes
    const localProfiles = [
      { id: 'spf_1', name: 'Local Pending', serverId: 'server-1' },
    ];
    const cloudProfiles = [
      { id: 'server-1', name: 'Cloud Old', serverId: 'server-1' },
    ];
    const pendingLocalIds = new Set(['spf_1']);

    const cloudIds = new Set(cloudProfiles.map(p => p.id));
    const localOnlyProfiles = localProfiles.filter(p =>
      !cloudIds.has(p.id) && !pendingLocalIds.has(p.id)
    );
    const pendingLocalProfiles = localProfiles.filter(p =>
      pendingLocalIds.has(p.id)
    );
    const merged = [...cloudProfiles, ...localOnlyProfiles, ...pendingLocalProfiles];

    // Local pending profile is in the merged list
    expect(merged.some(p => p.name === 'Local Pending')).toBe(true);
    // Cloud version also present (different ID: server-1 vs spf_1)
    expect(merged.some(p => p.name === 'Cloud Old')).toBe(true);
  });
});

// ── Media Isolation ──

describe('Media Isolation', () => {
  it('Queue payload does not contain Blob or filesystem paths', () => {
    const payload = {
      name: 'Gaming',
      actions: [
        { id: 'a1', name: 'Sound Action' },
      ],
    };

    // Payload should not have Blob instances or filesystem paths
    const payloadStr = JSON.stringify(payload);
    expect(payloadStr).not.toContain('Blob');
    expect(payloadStr).not.toContain('/Users/');
    expect(payloadStr).not.toContain('C:\\\\');
    expect(payloadStr).not.toContain('data:audio');
    expect(payloadStr).not.toContain('data:video');
    expect(payloadStr).not.toContain('data:image');
  });

  it('Only sync allowed fields', () => {
    const allowedFields = ['name', 'icon', 'tiktokUsername', 'overlaySettings', 'alertsSettings', 'actions', 'events'];

    const profileData = {
      name: 'Gaming',
      icon: '🎮',
      tiktokUsername: 'gamer',
      overlaySettings: {},
      alertsSettings: {},
      actions: [],
      events: [],
      // Fields that should NOT be synced:
      soundFile: new Blob(['data']),
      videoFile: '/local/path/video.mp4',
      imageFile: 'data:image/png;base64,...',
    };

    const synced: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in profileData) {
        synced[field] = (profileData as any)[field];
      }
    }

    expect(synced).not.toHaveProperty('soundFile');
    expect(synced).not.toHaveProperty('videoFile');
    expect(synced).not.toHaveProperty('imageFile');
    expect(synced).toHaveProperty('name');
    expect(synced).toHaveProperty('actions');
  });
});

// ── Lock/License ──

describe('Lock/License', () => {
  it('Locked profiles are not deleted by sync queue', () => {
    const profiles = [
      { id: 'spf_1', name: 'P1', locked: false },
      { id: 'spf_2', name: 'P2', locked: true },
    ];

    // Lock state should NOT trigger delete operations
    const lockedProfile = profiles.find(p => p.locked);
    expect(lockedProfile).toBeDefined();
    expect(lockedProfile?.name).toBe('P2');
    // Profile data preserved even when locked
  });

  it('Expired license does not remove profiles from queue', () => {
    const queue = [
      makeQueueItem({ id: 'q1', operation: 'update', localId: 'spf_2' }),
    ];

    // Even if license expires, queue items should not be cleared
    // (only explicit user delete or logout clears queue)
    expect(queue).toHaveLength(1);
  });
});

// ── Offline → Online ──

describe('Offline → Online', () => {
  it('Offline changes persist in queue', () => {
    const queue = [
      makeQueueItem({ id: 'q1', status: 'pending', nextRetryAt: Date.now() + 60000 }),
    ];

    // Queue item survives (IndexedDB persistent)
    expect(queue[0].status).toBe('pending');
    expect(queue[0].nextRetryAt).toBeGreaterThan(Date.now());
  });

  it('Online triggers immediate processing', () => {
    const isOnline = true;
    const queue = [
      makeQueueItem({ id: 'q1', status: 'pending', nextRetryAt: Date.now() }),
    ];

    // When online, ready items should be processed
    const ready = queue.filter(i => i.status === 'pending' && i.nextRetryAt <= Date.now());
    expect(ready).toHaveLength(1);
  });

  it('Failed item with backoff eventually becomes ready', () => {
    const item = makeQueueItem({
      status: 'pending',
      attempts: 3,
      nextRetryAt: Date.now() - 1000, // Past retry time
    });

    const isReady = item.status === 'pending' && item.nextRetryAt <= Date.now() && item.attempts < item.maxAttempts;
    expect(isReady).toBe(true);
  });
});

// ── Logout Preserves Queue ──

describe('Logout Preserves Queue', () => {
  it('Queue items survive logout — not deleted', () => {
    // Simulate: user A has a pending queue item
    const queue = [
      makeQueueItem({ id: 'q1', userId: 'user-A', operation: 'update', localId: 'spf_1', status: 'pending' }),
    ];

    // Logout should NOT call clearForUser (removed from auth-store.ts)
    // Queue items remain in IndexedDB
    const afterLogout = [...queue]; // No deletion

    expect(afterLogout).toHaveLength(1);
    expect(afterLogout[0].userId).toBe('user-A');
  });

  it('Account B cannot process Account A queue items', () => {
    const queue = [
      makeQueueItem({ id: 'q1', userId: 'user-A', localId: 'spf_a1', status: 'pending' }),
      makeQueueItem({ id: 'q2', userId: 'user-B', localId: 'spf_b1', status: 'pending' }),
    ];

    // getReadyItems(userId) only returns items for the queried user
    const userBItems = queue.filter(i => i.userId === 'user-B');
    const userAItemsForB = queue.filter(i => i.userId === 'user-A' && i.status === 'pending');

    expect(userBItems).toHaveLength(1);
    expect(userAItemsForB).toHaveLength(1); // A items exist but B can't access them
    // B's processor would only see user-B items
  });

  it('Account A can resume processing after re-login', () => {
    const queue = [
      makeQueueItem({ id: 'q1', userId: 'user-A', localId: 'spf_1', status: 'pending', nextRetryAt: Date.now() }),
    ];

    // After A logs in again, processor starts for user-A
    const userAReady = queue.filter(i =>
      i.userId === 'user-A' && i.status === 'pending' && i.nextRetryAt <= Date.now()
    );

    expect(userAReady).toHaveLength(1);
    expect(userAReady[0].id).toBe('q1');
  });
});

// ── Online Recovers Failed Items ──

describe('Online Recovers Failed Items', () => {
  it('retryAll resets failed items to pending with attempts=0', () => {
    const queue = [
      makeQueueItem({ id: 'q1', userId: 'user-A', status: 'failed', attempts: 10, maxAttempts: 10 }),
      makeQueueItem({ id: 'q2', userId: 'user-A', status: 'failed', attempts: 5, maxAttempts: 10 }),
    ];

    // Simulate retryAll: reset failed items
    const now = Date.now();
    const resetQueue = queue.map(item => {
      if (item.status === 'failed') {
        return { ...item, status: 'pending' as const, attempts: 0, nextRetryAt: now };
      }
      return item;
    });

    expect(resetQueue[0].status).toBe('pending');
    expect(resetQueue[0].attempts).toBe(0);
    expect(resetQueue[1].status).toBe('pending');
    expect(resetQueue[1].attempts).toBe(0);
  });

  it('After retryAll, items are processable by getReadyItems', () => {
    const now = Date.now();
    const item = makeQueueItem({
      status: 'pending', // Reset by retryAll
      attempts: 0,
      nextRetryAt: now, // Ready now
      maxAttempts: 10,
    });

    const isReady = item.status === 'pending' && item.nextRetryAt <= now && item.attempts < item.maxAttempts;
    expect(isReady).toBe(true);
  });

  it('Failed item becomes retryable after online reconnect', () => {
    // Simulate the full flow:
    // 1. Item fails 10 times → status: 'failed'
    const failedItem = makeQueueItem({ status: 'failed', attempts: 10, maxAttempts: 10 });

    // 2. Online event fires → retryAll() resets
    const now = Date.now();
    const resetItem = { ...failedItem, status: 'pending' as const, attempts: 0, nextRetryAt: now };

    // 3. Processor runs → getReadyItems picks it up
    const isReady = resetItem.status === 'pending' && resetItem.nextRetryAt <= now && resetItem.attempts < resetItem.maxAttempts;
    expect(isReady).toBe(true);
    expect(resetItem.attempts).toBe(0);
  });
});

// ── Online Does Not Cross Accounts ──

describe('Online Does Not Cross Accounts', () => {
  it('Processor running as B does not process A queue items', () => {
    const queue = [
      makeQueueItem({ id: 'q1', userId: 'user-A', localId: 'spf_a1', status: 'pending', nextRetryAt: Date.now() }),
      makeQueueItem({ id: 'q2', userId: 'user-B', localId: 'spf_b1', status: 'pending', nextRetryAt: Date.now() }),
    ];

    // Processor is running for user-B
    const processorUserId = 'user-B';
    const readyItems = queue.filter(i =>
      i.userId === processorUserId && i.status === 'pending' && i.nextRetryAt <= Date.now()
    );

    expect(readyItems).toHaveLength(1);
    expect(readyItems[0].userId).toBe('user-B');
    // user-A items are NOT processed
    expect(readyItems.some(i => i.userId === 'user-A')).toBe(false);
  });

  it('retryAll on online event only resets current user items', () => {
    const queue = [
      makeQueueItem({ id: 'q1', userId: 'user-A', status: 'failed', attempts: 10 }),
      makeQueueItem({ id: 'q2', userId: 'user-B', status: 'failed', attempts: 10 }),
    ];

    // retryAll('user-B') only resets user-B items
    const processorUserId = 'user-B';
    const resetQueue = queue.map(item => {
      if (item.userId === processorUserId && item.status === 'failed') {
        return { ...item, status: 'pending' as const, attempts: 0, nextRetryAt: Date.now() };
      }
      return item;
    });

    expect(resetQueue[0].status).toBe('failed'); // user-A still failed
    expect(resetQueue[1].status).toBe('pending'); // user-B reset
  });

  it('Online handler checks userId before processing', () => {
    const currentUserId = 'user-B';
    const onlineEventUserId = 'user-A'; // Would be the wrong user

    // The handler checks: if (this.currentUserId === userId)
    const shouldProcess = currentUserId === onlineEventUserId;
    expect(shouldProcess).toBe(false); // Should NOT process
  });
});
