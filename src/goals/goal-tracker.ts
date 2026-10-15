// =============================================
// RosaeFinity — Goal Tracker
// Centralized TikTok-event → Goal-state processor.
// Called from dispatchTikTokEvent() for every incoming event.
//
// Architecture (single source of truth):
//   TikTok event → trackGoalEvent / trackGoalOverlayEvents
//     → goal-state mutation ONCE (legacy store / instance config)
//     → broadcast (sendToOverlay + SSE + localStorage)
//     → renderers (GoalProgressRenderer etc.) are READ-ONLY
//
// Semantics (FINAL — see GOALS-FORENSIC-AUDIT.md):
//   - Like/Follow/Gift goals are LIVE-SESSION counters (reset on new roomId)
//   - Like delta: session baseline vs cumulative total; batch count fallback
//   - Gift delta: diamondCount × repeatCount (audited; combo filtered upstream)
//   - Dedup by common.msgId (deterministic fallback when absent)
//   - increase: newTarget = target + initialTarget, progress PRESERVED
//   - double:   newTarget = target × 2, progress PRESERVED
//   - keep:     target unchanged, progress continues
// =============================================

import { useGoalStore } from '../store/goal-store';
import { useAppStore } from '../store/app-store';
import { executeAction } from '../store/event-dispatch';
import { useOverlayStore } from '../lib/overlay-store';
import { sendToOverlay } from '../lib/overlay-bus';
import {
  observeGoalSession,
  getGoalSessionId,
  goalDedupKey,
  isDuplicateGoalEvent,
  computeLikeDelta,
  computeGiftCoinValue,
  applyReachedBehavior,
  clearLikeBaseline,
  restoreLikeBaseline,
  persistGoalSessionState,
  loadGoalSessionState,
  setLikeBaseline,
} from './goal-session';

// [GOAL_RUNTIME_VERIFY_V2] Temporary runtime source marker (verification only).
// Logged once at module load to prove the CURRENT bundle is executing:
// strict event isolation + roomId propagation + subscribe isolation.
console.log('[GOAL_RUNTIME_VERIFY_V2]', JSON.stringify({
  module: typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : 'bundled',
  strictIsolation: 'likes<-like|followers<-follow|gifts<-gift',
  subscribeIsolated: true,
  roomIdPropagation: 'tiktok-service._resolveEventIdentity',
  likeHydration: 'first-total-SET-not-add',
}));

let goalsLoaded = false;
let sessionStateLoaded = false;

/**
 * Initialize goals from Dexie on first use.
 */
async function ensureGoalsLoaded(): Promise<void> {
  if (!sessionStateLoaded) {
    loadGoalSessionState();
    sessionStateLoaded = true;
  }
  if (goalsLoaded) return;
  const { loaded } = useGoalStore.getState();
  if (!loaded) {
    await useGoalStore.getState().loadGoals();
  }
  goalsLoaded = true;
}

/**
 * Reset the goals-loaded flag so goals are re-fetched from Dexie on next use.
 * Called on logout to ensure account isolation (F-001 fix).
 */
export function resetGoalsLoaded(): void {
  goalsLoaded = false;
  sessionStateLoaded = false;
}

// ─── Session synchronization (called by BOTH trackers) ───
// observeGoalSession mutates the module-level session id; the FIRST call
// per event (with a new roomId) returns isNewSession=true and performs
// ALL resets (legacy goals + instance configs). Subsequent calls in the
// same event see the same roomId and no-op — safe under any call order.

export interface GoalSessionSync {
  isNewSession: boolean;
  sessionId: string | null;
}

export function syncGoalSession(data: { roomId?: string | null } | null | undefined): GoalSessionSync {
  const check = observeGoalSession(data?.roomId ?? null);
  console.log('[GOAL-SESSION]', JSON.stringify({
    eventRoomId: data?.roomId ?? null,
    activeSessionId: check.sessionId,
    previousSessionId: check.previousSessionId,
    isNewSession: check.isNewSession,
  }));

  if (!check.isNewSession) return check;

  console.log('[GOAL-SESSION] NEW LIVE detected — resetting goal progress to zero', JSON.stringify({
    newSessionId: check.sessionId,
    previousSessionId: check.previousSessionId,
  }));

  // ── Reset legacy global goals ──
  const store = useGoalStore.getState();
  for (const goal of store.goals) {
    clearLikeBaseline(goal.id);
    // resetGoalCurrent broadcasts current=0 so overlays show the fresh session
    store.resetGoalCurrent(goal.id);
    store.updateRuntime(goal.id, {
      sessionId: check.sessionId,
      lastLikeTotal: 0,
    });
  }

  // ── Reset instance-based goal overlays (ALL goal modules, any type) ──
  const overlayStore = useOverlayStore.getState();
  const goalInstances = overlayStore.instances.filter(
    (inst) => inst.enabled && (inst.moduleId === 'goal-progress' || inst.moduleId === 'goal-followers' || inst.moduleId === 'goal-gifts'),
  );
  for (const instance of goalInstances) {
    console.log('[GOAL-SESSION] resetting instance goal', JSON.stringify({
      instanceId: instance.id,
      moduleId: instance.moduleId,
      previousCurrent: (instance.config as any)?.current ?? 0,
    }));
    // Same as legacy goals above: a NEW LIVE must clear the like baseline,
    // otherwise the stale session baseline swallows the new room's first
    // like (total <= old baseline → delta 0).
    clearLikeBaseline(instance.id);
    // [GOAL-CONFIG-FORENSIC] Temporary diagnostics — the partial updateConfig
    // payload that overlay-store REPLACES wholesale (boundary C trigger).
    const prevCfg = (instance.config ?? {}) as any;
    const resetPayload = {
      current: 0,
      reached: false,
      lastCompletedTarget: 0,
      sessionId: check.sessionId,
      lastLikeTotal: 0,
    };
    console.log('[GOAL-CONFIG-FORENSIC] session-reset-partial-payload', JSON.stringify({
      boundary: 'C-trigger-session-reset',
      instanceId: instance.id,
      moduleId: instance.moduleId,
      payloadKeys: Object.keys(resetPayload),
      previousConfigKeys: Object.keys(prevCfg),
      willDropKeys: Object.keys(prevCfg).filter((k) => !(k in resetPayload)),
      previousValues: {
        target: prevCfg.target ?? null,
        initialTarget: prevCfg.initialTarget ?? null,
        reachedBehavior: prevCfg.reachedBehavior ?? null,
      },
    }));
    overlayStore.updateConfig(instance.id, resetPayload);
    // [GOAL-SESSION-RESET-FORENSIC] Temporary diagnostics — Task 5
    console.log('[GOAL-SESSION-RESET-FORENSIC]', JSON.stringify({
      instanceId: instance.id,
      moduleId: instance.moduleId,
      previousCurrent: prevCfg.current ?? null,
      newCurrent: 0,
      previousSessionId: prevCfg.sessionId ?? null,
      newSessionId: check.sessionId,
      reason: 'new-live-session',
    }));
    // [GOAL-CONFIG-AFTER-SESSION-RESET] (TASK 6) — prove merge preserved
    // target/reachedBehavior/initialTarget. Must NOT show target:0/behavior:null
    // for a configured Increase goal; current must be 0 after reset.
    const afterStore = useOverlayStore.getState();
    const resulting = (typeof (afterStore as any).getInstance === 'function'
      ? (afterStore as any).getInstance(instance.id)
      : (afterStore.instances ?? []).find((i: any) => i.id === instance.id)) ?? null;
    const rc = (resulting?.config ?? {}) as any;
    console.log('[GOAL-CONFIG-AFTER-SESSION-RESET]', JSON.stringify({
      moduleId: instance.moduleId,
      target: rc.target ?? null,
      initialTarget: rc.initialTarget ?? null,
      reachedBehavior: rc.reachedBehavior ?? null,
      current: rc.current ?? null,
      reached: rc.reached ?? null,
      sessionId: rc.sessionId ?? null,
    }));
  }

  persistGoalSessionState();
  return check;
}

// ─── Shared per-goal delta computation ──────────────────

interface GoalDeltaInput {
  goalKey: string; // goal.id or instance.id — dedup + baseline namespace
  goalType: 'likes' | 'followers' | 'gifts' | string;
  data: any;
}

interface GoalDeltaResult {
  delta: number;
  source: string;
  nextLikeTotal?: number;
  /** When set (like-goal first observation), SET progress to this value
   *  (current LIVE cumulative total) — do not add it. */
  hydrateTo?: number;
}

function computeGoalDelta(input: GoalDeltaInput): GoalDeltaResult {
  const { goalKey, goalType, data } = input;

  // STRICT EVENT ISOLATION: each Goal type mutates ONLY on its own event
  // type. Unrelated events return delta 0 before any mutation path.
  switch (goalType) {
    case 'likes': {
      if (data?.type !== 'like') return { delta: 0, source: 'event-mismatch' };
      const result = computeLikeDelta(goalKey, data);
      // [GOAL-LIKE-FORENSIC] hydration/delta decision (temporary diagnostics)
      console.log('[GOAL-LIKE-FORENSIC]', JSON.stringify({
        goalKey,
        decision: result.source,
        likeCount: data.likeCount ?? null,
        totalLikeCount: data.totalLikeCount ?? null,
        delta: result.delta,
        hydrateTo: result.hydrateTo ?? null,
        nextBaseline: result.nextBaseline,
      }));
      console.log('[GOAL-DELTA]', JSON.stringify({
        goalKey, goalType, eventType: data.type,
        delta: result.delta, source: result.source,
        hydrateTo: result.hydrateTo,
        likeCount: data.likeCount, totalLikeCount: data.totalLikeCount,
        nextBaseline: result.nextBaseline,
      }));
      return {
        delta: result.delta,
        source: result.source,
        nextLikeTotal: result.nextBaseline,
        hydrateTo: result.hydrateTo,
      };
    }
    case 'followers': {
      // HARD REQUIREMENT: follower Goal responds ONLY to follow events.
      // subscribe/share/etc. must never mutate follower progress.
      if (data?.type !== 'follow') return { delta: 0, source: 'event-mismatch' };
      console.log('[GOAL-DELTA]', JSON.stringify({ goalKey, goalType, eventType: data.type, delta: 1, source: 'follow-event' }));
      return { delta: 1, source: 'follow-event' };
    }
    case 'gifts': {
      if (data?.type !== 'gift') return { delta: 0, source: 'event-mismatch' };
      const value = computeGiftCoinValue(data);
      console.log('[GOAL-DELTA]', JSON.stringify({
        goalKey, goalType, eventType: data.type,
        delta: value, source: 'diamondCount*repeatCount',
        diamondCount: data.diamondCount, repeatCount: data.repeatCount,
      }));
      return { delta: value, source: 'diamondCount*repeatCount' };
    }
    default:
      return { delta: 0, source: 'unknown-goal-type' };
  }
}

// ─── Completion handling (shared by both trackers) ─────

interface CompletionInput {
  goalKey: string;
  title: string;
  behavior: string;
  target: number;
  initialTarget: number;
  newCurrent: number;
  lastCompletedTarget: number;
  actionId: string | null;
  actionContext: Record<string, unknown>;
}

interface CompletionResult {
  shouldApplyBehavior: boolean;
  fireAction: boolean;
}

function handleGoalCompletion(input: CompletionInput): CompletionResult {
  const { goalKey, title, behavior, target, initialTarget, newCurrent, lastCompletedTarget, actionId } = input;

  if (newCurrent < target) return { shouldApplyBehavior: false, fireAction: false };

  const alreadyFired = lastCompletedTarget >= target;
  console.log('[GOAL-COMPLETE] target reached', JSON.stringify({
    goalKey, title, current: newCurrent, target,
    alreadyFired, lastCompletedTarget, behavior, initialTarget,
  }));

  let fireAction = false;
  if (!alreadyFired && actionId) {
    const actions = useAppStore.getState().actions;
    const action = actions.find((a) => a.id === actionId);
    if (action && action.enabled) {
      console.log('[GOAL-ACTION] executing action', JSON.stringify({
        actionId: action.id, actionName: action.name, goalTitle: title, target,
      }));
      executeAction(action, {
        type: 'goal-reached',
        user: 'Goal System',
        goalTitle: title,
        timestamp: Date.now(),
        ...input.actionContext,
      });
      fireAction = true;
    } else {
      console.log('[GOAL-ACTION] action not found or disabled', actionId);
    }
  }

  // Reached behavior always applies on milestone (target progression),
  // even when the action already fired for this milestone.
  return { shouldApplyBehavior: true, fireAction };
}

// ─── Instance-based goal tracking ───────────────────────
// Registered goal modules store progress in overlay instance config:
//   goal-progress (display name "Goal Likes") ← like events
//   goal-followers ← follow events
//   goal-gifts     ← gift events
// NOTE: 'goal-likes' is NOT a registered module (removed in F-010);
// the registered Like module id is 'goal-progress'.

const MODULE_EVENT_MAP: Record<string, string> = {
  'goal-progress': 'like',
  'goal-followers': 'follow',
  'goal-gifts': 'gift',
};

/** Registered moduleId → GoalType used by computeGoalDelta/legacy store.
 *  'goal-progress'.replace('goal-','') would yield 'progress' which is NOT
 *  a goal type — the map is authoritative. */
const GOAL_MODULE_TYPE: Record<string, string> = {
  'goal-progress': 'likes',
  'goal-followers': 'followers',
  'goal-gifts': 'gifts',
};

/**
 * Track TikTok events against instance-based goal overlays.
 * Called from dispatchTikTokEvent() for every incoming event.
 * Updates overlay instance configs directly (single mutation path).
 */
export function trackGoalOverlayEvents(data: any): void {
  if (!data) return;

  ensureGoalsLoaded();

  // Session sync first — resets ALL instance goals on a new LIVE
  const session = syncGoalSession(data);

  const eventType = data.type;
  if (!eventType) return;

  // Find the module IDs that care about this event type.
  // STRICT ISOLATION: goal-progress ← like only; goal-followers ← follow only;
  // goal-gifts ← gift only. No cross-event routing.
  const relevantModules = Object.entries(MODULE_EVENT_MAP)
    .filter(([, expectedType]) => eventType === expectedType)
    .map(([moduleId]) => moduleId);

  if (relevantModules.length === 0) return;

  const dedupKey = goalDedupKey(data);
  console.log('[GOAL-EVENT-RECEIVED]', JSON.stringify({
    tracker: 'instance',
    eventType,
    roomId: data.roomId ?? null,
    msgId: data.msgId ?? null,
    dedupKey,
    activeSessionId: getGoalSessionId(),
    relevantModules,
  }));

  const overlayStore = useOverlayStore.getState();
  const instances = overlayStore.instances.filter(
    (inst) => inst.enabled && relevantModules.includes(inst.moduleId)
  );

  // [GOAL-LIKE-FORENSIC] Temporary diagnostics (verification only, no behavior change).
  // Proves WHY a like event does/doesn't mutate: dumps every overlay instance's
  // moduleId vs relevantModules, plus raw like fields exactly as received.
  if (eventType === 'like') {
    console.log('[GOAL-LIKE-FORENSIC]', JSON.stringify({
      eventType,
      roomId: data.roomId ?? null,
      msgId: data.msgId ?? null,
      relevantModules,
      likeCount: data.likeCount ?? null,
      totalLikeCount: data.totalLikeCount ?? null,
      rawCount: data.count ?? null,
      rawTotal: data.total ?? null,
      activeSessionId: getGoalSessionId(),
      eventRoomId: data.roomId ?? null,
      allInstances: overlayStore.instances.map((i) => ({
        id: i.id,
        moduleId: i.moduleId,
        enabled: i.enabled,
        current: (i.config as any)?.current ?? null,
        target: (i.config as any)?.target ?? null,
      })),
      matchedInstanceIds: instances.map((i) => i.id),
      decision: instances.length === 0 ? 'no-matching-instances' : 'will-process-instances',
      returnReason: instances.length === 0
        ? `no enabled instance with moduleId in ${JSON.stringify(relevantModules)} — relevantModules is map-derived, not instance-derived`
        : null,
    }));
  }

  // Dedup decision applies per event (same logical event → one mutation)
  // Session reset above must still happen even for duplicates — handled
  // because syncGoalSession runs before dedup and is idempotent per roomId.
  const duplicate = isDuplicateGoalEvent(dedupKey, 'instance');
  if (duplicate) {
    console.log('[GOAL-DEDUP] duplicate event skipped', JSON.stringify({ dedupKey, eventType, namespace: 'instance' }));
    return;
  }

  // [GOAL-ROUTING-FORENSIC] Temporary diagnostics — per-event routing summary
  const routingMutations: Array<Record<string, unknown>> = [];

  for (const instance of instances) {
    const config = instance.config as any;
    const current = config.current || 0;
    const target = config.target || 0;
    const reached = config.reached || false;
    const lastCompletedTarget = config.lastCompletedTarget || 0;
    const initialTarget = (typeof config.initialTarget === 'number' && config.initialTarget > 0)
      ? config.initialTarget
      : target;

    // [GOAL-LIKE-FORENSIC-CONFIG] per matched instance (temporary diagnostics)
    if (eventType === 'like') {
      console.log('[GOAL-LIKE-FORENSIC-CONFIG]', JSON.stringify({
        instanceId: instance.id,
        moduleId: instance.moduleId,
        enabled: instance.enabled,
        current,
        target,
        behavior: config.reachedBehavior ?? null,
        initialTarget,
        goalCurrent: current,
        goalTarget: target,
      }));
    }

    const { delta, source, nextLikeTotal, hydrateTo } = computeGoalDelta({
      goalKey: instance.id,
      goalType: GOAL_MODULE_TYPE[instance.moduleId] ?? instance.moduleId.replace('goal-', ''),
      data,
    });
    // hydrate-total: first observation of this session's likes — SET progress
    // to the current LIVE total (join-running-LIVE / fresh room alike).
    if (source !== 'hydrate-total' && delta <= 0) continue;

    const newCurrent = typeof hydrateTo === 'number' ? hydrateTo : current + delta;

    // [GOAL-LIKE-HYDRATION-FORENSIC] Temporary diagnostics — Task 6
    if (source === 'hydrate-total') {
      console.log('[GOAL-LIKE-HYDRATION-FORENSIC]', JSON.stringify({
        instanceId: instance.id,
        moduleId: instance.moduleId,
        roomId: data.roomId ?? null,
        previousCurrent: current,
        hydratedTotal: hydrateTo,
        newCurrent,
      }));
    }

    console.log('[GOAL-MUTATED]', JSON.stringify({
      tracker: 'instance',
      instanceId: instance.id,
      moduleId: instance.moduleId,
      oldCurrent: current,
      addedDelta: source === 'hydrate-total' ? 0 : delta,
      hydratedTo: source === 'hydrate-total' ? hydrateTo : undefined,
      newCurrent,
      target,
      deltaSource: source,
      eventType,
    }));

    // [GOAL-MUTATION-FORENSIC] Temporary diagnostics — every actual mutation
    const mutationRec = {
      eventType,
      moduleId: instance.moduleId,
      instanceId: instance.id,
      beforeCurrent: current,
      delta: source === 'hydrate-total' ? 0 : delta,
      afterCurrent: newCurrent,
      target,
      behavior: config.reachedBehavior ?? null,
      roomId: data.roomId ?? null,
      dedupKey,
      source,
      function: 'trackGoalOverlayEvents.instance-loop',
      callsite: 'goal-tracker.ts computeGoalDelta→applyReachedBehavior→updateConfig',
    };
    routingMutations.push(mutationRec);
    console.log('[GOAL-MUTATION-FORENSIC]', JSON.stringify(mutationRec));

    const updates: Record<string, any> = { current: newCurrent };
    if (typeof nextLikeTotal === 'number') updates.lastLikeTotal = nextLikeTotal;
    if (session.sessionId !== undefined) updates.sessionId = session.sessionId;

    const completion = handleGoalCompletion({
      goalKey: instance.id,
      title: config.title || instance.moduleId,
      behavior: config.reachedBehavior || 'keep',
      target,
      initialTarget,
      newCurrent,
      lastCompletedTarget,
      actionId: config.actionId ?? null,
      actionContext: { goalType: instance.moduleId, instanceId: instance.id },
    });

    if (completion.shouldApplyBehavior) {
      const result = applyReachedBehavior({
        behavior: config.reachedBehavior || 'keep',
        target,
        current: newCurrent,
        initialTarget,
      });
      updates.target = result.newTarget;
      updates.current = result.newCurrent; // cumulative progress PRESERVED
      updates.reached = result.reached;
      updates.lastCompletedTarget = result.lastCompletedTarget;
      // Persist the ORIGINAL step base resolved above (config.initialTarget
      // or the pre-increase target). Never write result.newTarget here —
      // initialTarget must not track the mutated target.
      updates.initialTarget = initialTarget;
      console.log('[GOAL-BEHAVIOR]', JSON.stringify({
        tracker: 'instance',
        instanceId: instance.id,
        behavior: config.reachedBehavior,
        oldTarget: target,
        newTarget: result.newTarget,
        initialTarget,
        currentPreserved: result.newCurrent,
        reached: result.reached,
        formula: config.reachedBehavior === 'increase'
          ? 'newTarget = target + initialTarget'
          : config.reachedBehavior === 'double'
            ? 'newTarget = target * 2'
            : 'unchanged',
      }));
    }

    // Persist updated config (single mutation for this event)
    overlayStore.updateConfig(instance.id, updates);

    // Broadcast resulting state to ALL overlays/renderers (read-only consumers)
    const broadcastData = {
      type: 'goal-progress',
      goalId: instance.id,
      current: updates.current ?? newCurrent,
      target: updates.target ?? target,
      goalType: GOAL_MODULE_TYPE[instance.moduleId] ?? instance.moduleId.replace('goal-', ''),
      title: config.title,
      barColor: config.barColor,
      reached: updates.reached ?? reached,
    };
    console.log('[GOAL-BROADCAST]', JSON.stringify({
      tracker: 'instance',
      goalId: broadcastData.goalId,
      current: broadcastData.current,
      target: broadcastData.target,
      reached: broadcastData.reached,
    }));
    sendToOverlay(broadcastData as any);
  }

  // [GOAL-ROUTING-FORENSIC] Temporary diagnostics — end-of-event routing summary.
  // matchedModules MUST be event-type-specific (like→goal-progress only, etc.).
  console.log('[GOAL-ROUTING-FORENSIC]', JSON.stringify({
    eventType,
    matchedModules: relevantModules,
    matchedInstances: instances.map((i) => ({ id: i.id, moduleId: i.moduleId })),
    mutatedInstances: routingMutations.map((m) => ({
      instanceId: m.instanceId,
      moduleId: m.moduleId,
      delta: m.delta,
      beforeCurrent: m.beforeCurrent,
      afterCurrent: m.afterCurrent,
    })),
    mutationDelta: routingMutations.map((m) => m.delta),
    dedupKey,
    roomId: data.roomId ?? null,
  }));
}

// ─── Legacy global goal store tracking ──────────────────

/**
 * Track TikTok events against active goals in the global goal store.
 * Called from dispatchTikTokEvent() for every incoming event.
 */
export function trackGoalEvent(data: any): void {
  if (!data) return;

  ensureGoalsLoaded();

  // Session sync first — resets legacy goals on a new LIVE
  const session = syncGoalSession(data);

  const store = useGoalStore.getState();
  const { goals, runtime, setGoalCurrent, markGoalReached, updateRuntime } = store;

  const activeGoals = goals.filter((g) => g.enabled);
  if (activeGoals.length === 0) return;

  const dedupKey = goalDedupKey(data);
  console.log('[GOAL-EVENT-RECEIVED]', JSON.stringify({
    tracker: 'legacy',
    eventType: data.type,
    roomId: data.roomId ?? null,
    msgId: data.msgId ?? null,
    dedupKey,
    activeSessionId: getGoalSessionId(),
    activeGoalCount: activeGoals.length,
  }));

  const duplicate = isDuplicateGoalEvent(dedupKey, 'legacy');
  if (duplicate) {
    console.log('[GOAL-DEDUP] duplicate event skipped', JSON.stringify({ dedupKey, eventType: data.type, namespace: 'legacy' }));
    return;
  }

  for (const goal of activeGoals) {
    // Re-read live state each iteration — earlier goals in this loop may
    // have mutated the store (increase/double target changes).
    const liveState = useGoalStore.getState();
    const rt = liveState.runtime[goal.id];
    const liveGoal = liveState.goals.find((g) => g.id === goal.id) || goal;
    if (!rt) continue;

    // Restore like baseline from persisted runtime (reload continuity)
    restoreLikeBaseline(goal.id, rt.lastLikeTotal);

    const { delta, source, nextLikeTotal, hydrateTo } = computeGoalDelta({
      goalKey: goal.id,
      goalType: goal.type,
      data,
    });
    // hydrate-total: first observation of this session's likes — SET progress
    // to the current LIVE total (join-running-LIVE / fresh room alike).
    if (source !== 'hydrate-total' && delta <= 0) continue;

    const newCurrent = typeof hydrateTo === 'number' ? hydrateTo : (rt.current || 0) + delta;

    console.log('[GOAL-MUTATED]', JSON.stringify({
      tracker: 'legacy',
      goalId: goal.id,
      title: goal.title,
      oldCurrent: rt.current || 0,
      addedDelta: source === 'hydrate-total' ? 0 : delta,
      hydratedTo: source === 'hydrate-total' ? hydrateTo : undefined,
      newCurrent,
      target: goal.target,
      deltaSource: source,
      eventType: data.type,
    }));

    setGoalCurrent(goal.id, newCurrent);
    if (typeof nextLikeTotal === 'number') {
      updateRuntime(goal.id, { lastLikeTotal: nextLikeTotal, sessionId: session.sessionId ?? rt.sessionId ?? null });
    } else if (session.sessionId !== undefined) {
      updateRuntime(goal.id, { sessionId: session.sessionId ?? rt.sessionId ?? null });
    }

    const completion = handleGoalCompletion({
      goalKey: goal.id,
      title: liveGoal.title,
      behavior: liveGoal.reachedBehavior,
      target: liveGoal.target,
      initialTarget: liveGoal.initialTarget && liveGoal.initialTarget > 0 ? liveGoal.initialTarget : liveGoal.target,
      newCurrent,
      lastCompletedTarget: rt.lastCompletedTarget || 0,
      actionId: liveGoal.actionId,
      actionContext: { goalType: liveGoal.type, goalId: goal.id },
    });

    if (completion.shouldApplyBehavior) {
      if (completion.fireAction) {
        markGoalReached(goal.id);
      }
      const result = applyReachedBehavior({
        behavior: liveGoal.reachedBehavior,
        target: liveGoal.target,
        current: newCurrent,
        initialTarget: liveGoal.initialTarget && liveGoal.initialTarget > 0 ? liveGoal.initialTarget : liveGoal.target,
      });

      console.log('[GOAL-BEHAVIOR]', JSON.stringify({
        tracker: 'legacy',
        goalId: goal.id,
        behavior: liveGoal.reachedBehavior,
        oldTarget: liveGoal.target,
        newTarget: result.newTarget,
        initialTarget: liveGoal.initialTarget && liveGoal.initialTarget > 0 ? liveGoal.initialTarget : liveGoal.target,
        currentPreserved: result.newCurrent,
        reached: result.reached,
        formula: liveGoal.reachedBehavior === 'increase'
          ? 'newTarget = target + initialTarget'
          : liveGoal.reachedBehavior === 'double'
            ? 'newTarget = target * 2'
            : 'unchanged',
      }));

      if (liveGoal.reachedBehavior === 'increase') {
        liveState.increaseGoalTarget(goal.id); // spec: target+initialTarget, progress preserved
      } else if (liveGoal.reachedBehavior === 'double') {
        liveState.doubleGoalTarget(goal.id); // spec: target×2, progress preserved
      } else if (liveGoal.reachedBehavior === 'hide') {
        markGoalReached(goal.id);
        updateRuntime(goal.id, { lastCompletedTarget: liveGoal.target });
      } else {
        // keep — reached state persists; progress continues against same target
        markGoalReached(goal.id);
        updateRuntime(goal.id, { lastCompletedTarget: liveGoal.target });
      }
    }
  }

  persistGoalSessionState();
}

// Exposed for tests / diagnostics
export { setLikeBaseline };
