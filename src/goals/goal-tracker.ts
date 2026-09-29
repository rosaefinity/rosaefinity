// =============================================
// RosaeFinity — Goal Tracker
// Intercepts TikTok events and updates goal progress.
// Called from dispatchTikTokEvent() after coin-jar block.
// =============================================

import { useGoalStore } from '../store/goal-store';
import { useAppStore } from '../store/app-store';
import { executeAction } from '../store/event-dispatch';
import { useOverlayStore } from '../lib/overlay-store';
import { sendToOverlay } from '../lib/overlay-bus';

let goalsLoaded = false;

/**
 * Initialize goals from Dexie on first use.
 */
async function ensureGoalsLoaded(): Promise<void> {
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
}

/**
 * Track TikTok events against active goals.
 * Called from dispatchTikTokEvent() for every incoming event.
 */
export function trackGoalEvent(data: any): void {
  if (!data) return;

  // Ensure goals are loaded from Dexie on first event
  ensureGoalsLoaded();

  const store = useGoalStore.getState();
  const { goals, runtime, setGoalCurrent, markGoalReached, increaseGoalTarget, resetGoalCurrent } = store;

  // Only process if there are enabled goals
  const activeGoals = goals.filter((g) => g.enabled);
  if (activeGoals.length === 0) return;

  for (const goal of activeGoals) {
    const rt = runtime[goal.id];
    if (!rt) continue;

    let delta = 0;

    switch (goal.type) {
      case 'likes':
        if (data.type === 'like') {
          // Use cumulative totalLikeCount from TikTok (authoritative)
          const totalLikes = data.totalLikeCount || data.likeCount || 0;
          // Use the higher of cumulative or increment
          delta = totalLikes > rt.current ? totalLikes - rt.current : (data.likeCount || 1);
        }
        break;

      case 'followers':
        if (data.type === 'follow' || data.type === 'subscribe') {
          delta = 1;
        }
        break;

      case 'gifts':
        if (data.type === 'gift') {
          const diamondCount = data.diamondCount || 0;
          const repeatCount = data.repeatCount || 1;
          delta = diamondCount * repeatCount;
        }
        break;
    }

    if (delta <= 0) continue;

    const newCurrent = rt.current + delta;
    setGoalCurrent(goal.id, newCurrent);

    // Check if goal is reached
    if (newCurrent >= goal.target) {
      // Action execution safety: only fire once per target milestone.
      // lastCompletedTarget tracks the target for which the action was already fired.
      const alreadyFired = (rt.lastCompletedTarget || 0) >= goal.target;

      console.log('[GOAL-COMPLETE] target reached:', {
        goalId: goal.id,
        title: goal.title,
        current: newCurrent,
        target: goal.target,
        alreadyFired,
        lastCompletedTarget: rt.lastCompletedTarget || 0,
      });

      if (!alreadyFired) {
        markGoalReached(goal.id);

        // Execute linked action (once per milestone)
        if (goal.actionId) {
          const actions = useAppStore.getState().actions;
          const action = actions.find((a) => a.id === goal.actionId);
          if (action && action.enabled) {
            console.log('[GOAL-ACTION] executing action:', {
              actionId: action.id,
              actionName: action.name,
              goalTitle: goal.title,
              target: goal.target,
            });
            executeAction(action, {
              type: 'goal-reached',
              user: 'Goal System',
              goalTitle: goal.title,
              goalType: goal.type,
              timestamp: Date.now(),
            });
          } else {
            console.log('[GOAL-ACTION] action not found or disabled:', goal.actionId);
          }
        }

        // Update lastCompletedTarget to prevent duplicate firing
        useGoalStore.getState().updateRuntime(goal.id, { lastCompletedTarget: goal.target });
      }

      // Apply reached behavior (runs even if action already fired, for target progression)
      switch (goal.reachedBehavior) {
        case 'increase':
          // Target increases by the original target amount: 7k → 14k → 21k → ...
          console.log('[GOAL-INCREASE] oldTarget → newTarget:', goal.target, '→', goal.target + goal.target);
          increaseGoalTarget(goal.id);
          break;
        case 'double':
          // Double the target, carry over overshoot
          {
            const overshoot = Math.max(0, newCurrent - goal.target);
            const newTarget = goal.target * 2;
            console.log('[GOAL-INCREASE] double:', goal.target, '→', newTarget, 'overshoot:', overshoot);
            useGoalStore.getState().updateGoal(goal.id, { target: newTarget });
            useGoalStore.getState().updateRuntime(goal.id, {
              current: overshoot,
              reached: false,
              lastCompletedTarget: 0,
            });
            useGoalStore.getState().broadcastGoalProgress(goal.id);
          }
          break;
        case 'hide':
          // Mark reached and stop tracking (overlay will hide)
          useGoalStore.getState().updateRuntime(goal.id, { reached: true });
          break;
        case 'keep':
        default:
          // Leave as-is (reached state persists, no target change)
          break;
      }
    }
  }
}

// ─── Instance-Based Goal Tracking ─────────────────────────────
// New goal modules (goal-likes, goal-followers, goal-gifts) store
// progress in overlay instance config, not in the global goal store.

const MODULE_EVENT_MAP: Record<string, string> = {
  'goal-likes': 'like',
  'goal-followers': 'follow',
  'goal-gifts': 'gift',
};

function computeInstanceDelta(moduleId: string, data: any, current: number): number {
  switch (moduleId) {
    case 'goal-likes':
      if (data.type === 'like') {
        const totalLikes = data.totalLikeCount || data.likeCount || 0;
        return totalLikes > current ? totalLikes - current : (data.likeCount || 1);
      }
      return 0;

    case 'goal-followers':
      if (data.type === 'follow' || data.type === 'subscribe') {
        return 1;
      }
      return 0;

    case 'goal-gifts':
      if (data.type === 'gift') {
        const diamondCount = data.diamondCount || 0;
        const repeatCount = data.repeatCount || 1;
        return diamondCount * repeatCount;
      }
      return 0;

    default:
      return 0;
  }
}

/**
 * Track TikTok events against instance-based goal overlays.
 * Called from dispatchTikTokEvent() for every incoming event.
 * Updates overlay instance configs directly.
 */
export function trackGoalOverlayEvents(data: any): void {
  if (!data) return;

  const eventType = data.type;
  if (!eventType) return;

  // Find the module IDs that care about this event type
  const relevantModules = Object.entries(MODULE_EVENT_MAP)
    .filter(([, expectedType]) => {
      if (expectedType === 'follow') return eventType === 'follow' || eventType === 'subscribe';
      return eventType === expectedType;
    })
    .map(([moduleId]) => moduleId);

  if (relevantModules.length === 0) return;

  const overlayStore = useOverlayStore.getState();
  const instances = overlayStore.instances.filter(
    (inst) => inst.enabled && relevantModules.includes(inst.moduleId)
  );

  for (const instance of instances) {
    const config = instance.config as any;
    const current = config.current || 0;
    const target = config.target || 0;
    const reached = config.reached || false;
    const lastCompletedTarget = config.lastCompletedTarget || 0;

    const delta = computeInstanceDelta(instance.moduleId, data, current);
    if (delta <= 0) continue;

    const newCurrent = current + delta;

    // Update instance config directly
    const updates: Record<string, any> = { current: newCurrent };

    // Check if goal is reached
    if (newCurrent >= target && !reached) {
      const alreadyFired = lastCompletedTarget >= target;

      console.log('[GOAL-INSTANCE-COMPLETE] target reached:', {
        instanceId: instance.id,
        moduleId: instance.moduleId,
        title: config.title,
        current: newCurrent,
        target,
        alreadyFired,
      });

      if (!alreadyFired) {
        updates.reached = true;
        updates.lastCompletedTarget = target;

        // Execute linked action (once per milestone)
        if (config.actionId) {
          const actions = useAppStore.getState().actions;
          const action = actions.find((a: any) => a.id === config.actionId);
          if (action && action.enabled) {
            console.log('[GOAL-INSTANCE-ACTION] executing:', {
              actionId: action.id,
              instanceId: instance.id,
            });
            executeAction(action, {
              type: 'goal-reached',
              user: 'Goal System',
              goalTitle: config.title,
              goalType: instance.moduleId,
              timestamp: Date.now(),
            });
          }
        }
      }

      // Apply reached behavior
      switch (config.reachedBehavior) {
        case 'increase': {
          const newTarget = target + target;
          updates.target = newTarget;
          updates.reached = false;
          updates.lastCompletedTarget = 0;
          updates.current = Math.max(0, newCurrent - target);
          break;
        }
        case 'double': {
          const overshoot = Math.max(0, newCurrent - target);
          updates.target = target * 2;
          updates.current = overshoot;
          updates.reached = false;
          updates.lastCompletedTarget = 0;
          break;
        }
        case 'hide':
          updates.reached = true;
          break;
        case 'keep':
        default:
          break;
      }
    }

    // Persist updated config
    overlayStore.updateConfig(instance.id, updates);

    // [OVERLAY-EVENT-FLOW] Goal progress broadcast
    const broadcastData = {
      type: 'goal-progress',
      goalId: instance.id,
      current: updates.current ?? newCurrent,
      target: updates.target ?? target,
      goalType: instance.moduleId.replace('goal-', ''),
      title: config.title,
      barColor: config.barColor,
      reached: updates.reached ?? reached,
    };
    console.log('[OVERLAY-EVENT-FLOW] Broadcasting goal-progress:', JSON.stringify({
      goalId: broadcastData.goalId,
      moduleId: instance.moduleId,
      current: broadcastData.current,
      target: broadcastData.target,
      reached: broadcastData.reached,
    }));
    sendToOverlay(broadcastData as any);
  }
}
