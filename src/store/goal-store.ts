// =============================================
// RosaeFinity — Goal Store (Zustand)
// Manages goal CRUD and runtime progress state.
// Persistence via Dexie (goals table).
// Progress broadcast via sendToOverlay().
// =============================================

import { create } from 'zustand';
import { db } from '../lib/db';
import { sendToOverlay } from '../lib/overlay-bus';
import type { Goal, GoalRuntime, GoalType, GoalReachedBehavior } from '../goals/types';

/** Get the current authenticated userId (or undefined if not logged in). */
function getCurrentUserId(): string | undefined {
  try {
    // Dynamic import to avoid circular dependency at module load time
    const authModule = require('./auth-store');
    return authModule?.useAuthStore?.getState?.()?.currentUser?.id;
  } catch { return undefined; }
}

interface GoalStore {
  goals: Goal[];
  runtime: Record<string, GoalRuntime>;
  loaded: boolean;

  // CRUD
  addGoal: (params: { type: GoalType; target: number; title: string; reachedBehavior: GoalReachedBehavior; increaseAmount: number; actionId: string | null }) => Goal;
  updateGoal: (id: string, updates: Partial<Omit<Goal, 'id' | 'createdAt'>>) => void;
  removeGoal: (id: string) => void;
  toggleGoal: (id: string) => void;

  // Runtime progress
  setGoalCurrent: (id: string, current: number) => void;
  markGoalReached: (id: string) => void;
  increaseGoalTarget: (id: string) => void;
  resetGoalCurrent: (id: string) => void;
  getGoalCurrent: (id: string) => number;
  updateRuntime: (id: string, updates: Partial<GoalRuntime>) => void;
  broadcastGoalProgress: (id: string) => void;

  // Persistence
  loadGoals: () => Promise<void>;
  persistGoal: (goal: Goal) => Promise<void>;
  deleteGoalFromDB: (id: string) => Promise<void>;
}

function generateId(): string {
  return `goal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function goalColors(goal: { barColor?: string; gradientColor?: string; textColor?: string; backgroundColor?: string }) {
  return { gradientColor: goal.gradientColor, textColor: goal.textColor, backgroundColor: goal.backgroundColor };
}

function broadcastProgress(goalId: string, current: number, target: number, goalType: string, title: string, barColor: string, reached?: boolean, colors?: { gradientColor?: string; textColor?: string; backgroundColor?: string }): void {
  try {
    sendToOverlay({
      type: 'goal-progress',
      goalId,
      current,
      target,
      goalType,
      title,
      barColor,
      gradientColor: colors?.gradientColor,
      textColor: colors?.textColor,
      backgroundColor: colors?.backgroundColor,
      reached: reached ?? false,
    } as any);
  } catch { /* overlay may not be connected */ }
  // Persist full config to localStorage — merge with existing to preserve customized colors
  try {
    let existing: Record<string, unknown> = {};
    try {
      const raw = localStorage.getItem('rf-goal-config');
      if (raw) existing = JSON.parse(raw);
    } catch { /* ignore */ }
    localStorage.setItem('rf-goal-config', JSON.stringify({
      ...existing,
      title,
      target,
      goalType,
      barColor,
      gradientColor: colors?.gradientColor,
      textColor: colors?.textColor,
      backgroundColor: colors?.backgroundColor,
    }));
  } catch { /* storage full */ }
  // Push to production Railway backend for HTTPS overlay
  pushToProductionBackend(goalId, current, target, goalType, title, barColor);
}

// Persist to localStorage for browser source widget hydration
function persistToLocalStorage(runtime: Record<string, GoalRuntime>): void {
  try {
    localStorage.setItem('rf-goals-runtime', JSON.stringify(runtime));
  } catch { /* storage full */ }
}

// ── Production backend push (for HTTPS overlay URL) ──
let cachedOverlayToken: string | null = null;

async function pushToProductionBackend(
  goalId: string, current: number, target: number,
  goalType: string, title: string, barColor: string
): Promise<void> {
  try {
    const api = (window as any).electronAPI;
    if (!api?.overlayGenerateToken || !api?.overlayPushState) return;

    // Get or generate overlay token
    if (!cachedOverlayToken) {
      const authStore = (await import('./auth-store')).useAuthStore.getState();
      const userId = authStore.currentUser?.id;
      if (!userId) return;
      const result = await api.overlayGenerateToken(userId);
      if (result?.success) cachedOverlayToken = result.token;
    }
    if (!cachedOverlayToken) return;

    // Build goal state array from store
    const { goals, runtime } = useGoalStore.getState();
    const goalStates = goals.filter(g => g.enabled).map(g => ({
      goalId: g.id,
      title: g.title,
      type: g.type,
      current: runtime[g.id]?.current ?? 0,
      target: g.target,
      barColor: g.barColor,
      reached: runtime[g.id]?.reached ?? false,
    }));

    await api.overlayPushState(cachedOverlayToken, goalStates);
  } catch { /* backend push is best-effort */ }
}

export const useGoalStore = create<GoalStore>()((set, get) => ({
  goals: [],
  runtime: {},
  loaded: false,

  addGoal: (params) => {
    const now = Date.now();
    const currentUserId = getCurrentUserId();
    const goal: Goal = {
      id: generateId(),
      type: params.type,
      target: params.target,
      title: params.title,
      reachedBehavior: params.reachedBehavior,
      increaseAmount: params.increaseAmount,
      actionId: params.actionId,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      userId: currentUserId,
    };

    set((s) => ({
      goals: [...s.goals, goal],
      runtime: {
        ...s.runtime,
        [goal.id]: { goalId: goal.id, current: 0, reached: false, lastCompletedTarget: 0 },
      },
    }));

    get().persistGoal(goal);
    return goal;
  },

  updateGoal: (id, updates) => {
    // Ownership check: reject if goal doesn't belong to current user
    const target = get().goals.find((g) => g.id === id);
    if (target && target.userId) {
      const currentUserId = getCurrentUserId();
      if (currentUserId && target.userId !== currentUserId) {
        console.warn('[GOAL-STORE] updateGoal blocked: goal belongs to another account');
        return;
      }
    }
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === id ? { ...g, ...updates, updatedAt: Date.now() } : g
      ),
    }));
    const updated = get().goals.find((g) => g.id === id);
    if (updated) get().persistGoal(updated);
  },

  removeGoal: (id) => {
    // Ownership check: reject if goal doesn't belong to current user
    const target = get().goals.find((g) => g.id === id);
    if (target && target.userId) {
      const currentUserId = getCurrentUserId();
      if (currentUserId && target.userId !== currentUserId) {
        console.warn('[GOAL-STORE] removeGoal blocked: goal belongs to another account');
        return;
      }
    }
    set((s) => {
      const { [id]: _, ...restRuntime } = s.runtime;
      return {
        goals: s.goals.filter((g) => g.id !== id),
        runtime: restRuntime,
      };
    });
    get().deleteGoalFromDB(id);
  },

  toggleGoal: (id) => {
    get().updateGoal(id, {
      enabled: !get().goals.find((g) => g.id === id)?.enabled,
    });
  },

  setGoalCurrent: (id, current) => {
    set((s) => ({
      runtime: {
        ...s.runtime,
        [id]: { ...s.runtime[id], goalId: id, current },
      },
    }));
    persistToLocalStorage(get().runtime);
    const goal = get().goals.find((g) => g.id === id);
    if (goal) broadcastProgress(id, current, goal.target, goal.type, goal.title, goal.barColor, undefined, goalColors(goal));
  },

  markGoalReached: (id) => {
    set((s) => ({
      runtime: {
        ...s.runtime,
        [id]: { ...s.runtime[id], goalId: id, reached: true },
      },
    }));
    persistToLocalStorage(get().runtime);
    // Broadcast reached state so overlay can hide if configured
    const goal = get().goals.find((g) => g.id === id);
    if (goal) broadcastProgress(id, get().runtime[id]?.current ?? 0, goal.target, goal.type, goal.title, goal.barColor, true, goalColors(goal));
  },

  increaseGoalTarget: (id) => {
    const goal = get().goals.find((g) => g.id === id);
    const rt = get().runtime[id];
    if (!goal || !rt) return;

    const overshoot = Math.max(0, rt.current - goal.target);
    // Target increases by the original target amount: 7k → 14k → 21k → ...
    const newTarget = goal.target + goal.target;

    get().updateGoal(id, { target: newTarget });
    set((s) => ({
      runtime: {
        ...s.runtime,
        [id]: { goalId: id, current: overshoot, reached: false, lastCompletedTarget: 0 },
      },
    }));
    persistToLocalStorage(get().runtime);
    broadcastProgress(id, overshoot, newTarget, goal.type, goal.title, goal.barColor, undefined, goalColors(goal));
  },

  resetGoalCurrent: (id) => {
    set((s) => ({
      runtime: {
        ...s.runtime,
        [id]: { goalId: id, current: 0, reached: false, lastCompletedTarget: 0 },
      },
    }));
    persistToLocalStorage(get().runtime);
    const goal = get().goals.find((g) => g.id === id);
    if (goal) broadcastProgress(id, 0, goal.target, goal.type, goal.title, goal.barColor, undefined, goalColors(goal));
  },

  getGoalCurrent: (id) => {
    return get().runtime[id]?.current ?? 0;
  },

  updateRuntime: (id, updates) => {
    set((s) => ({
      runtime: {
        ...s.runtime,
        [id]: { ...s.runtime[id], ...updates },
      },
    }));
    persistToLocalStorage(get().runtime);
  },

  broadcastGoalProgress: (id) => {
    const goal = get().goals.find((g) => g.id === id);
    const rt = get().runtime[id];
    if (goal && rt) {
      broadcastProgress(id, rt.current, goal.target, goal.type, goal.title, goal.barColor, rt.reached, goalColors(goal));
    }
  },

  loadGoals: async () => {
    try {
      const currentUserId = getCurrentUserId();
      let goals: Goal[];

      if (currentUserId) {
        // Account-scoped: only load goals belonging to the authenticated user.
        // Legacy unowned goals (no userId) are excluded — they cannot be safely
        // attributed to any account.
        goals = await db.goals.where('userId').equals(currentUserId).toArray() as Goal[];
      } else {
        // Not authenticated — load nothing (no account to scope to)
        goals = [];
      }

      // Restore runtime from localStorage if available
      let savedRuntime: Record<string, GoalRuntime> = {};
      try {
        const raw = localStorage.getItem('rf-goals-runtime');
        if (raw) savedRuntime = JSON.parse(raw);
      } catch { /* ignore */ }

      const runtime: Record<string, GoalRuntime> = {};
      for (const g of goals) {
        const saved = savedRuntime[g.id];
        runtime[g.id] = {
          goalId: g.id,
          current: saved?.current ?? 0,
          reached: saved?.reached ?? false,
          lastCompletedTarget: saved?.lastCompletedTarget ?? 0,
        };
      }
      set({ goals, runtime, loaded: true });
    } catch (err) {
      console.error('[GOAL-STORE] Failed to load goals:', err);
      set({ loaded: true });
    }
  },

  persistGoal: async (goal) => {
    try {
      await db.goals.put(goal);
    } catch (err) {
      console.error('[GOAL-STORE] Failed to persist goal:', err);
    }
  },

  deleteGoalFromDB: async (id) => {
    try {
      await db.goals.delete(id);
    } catch (err) {
      console.error('[GOAL-STORE] Failed to delete goal:', err);
    }
  },
}));
