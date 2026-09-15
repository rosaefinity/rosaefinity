import { useState, useMemo, useEffect, Suspense, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { getOverlayModules } from "../overlays/registry";
import { createCoinJarDemoEventSource } from "../overlays/coin-jar-pro/demoEventSource";
import { getOverlayWidgetUrl, getSSEBaseUrl } from "../lib/browser-source-url";
// Removed: useOverlayStore no longer needed — URL is generated directly
import { useLicenseStore } from "../store/license-store";
import { sendToOverlay } from "../lib/overlay-bus";
import { useGoalStore } from "../store/goal-store";
import { useAppStore } from "../store/app-store";
import { executeAction } from "../store/event-dispatch";
import { UpgradeDialog } from "../components/UpgradeDialog";
import {
  Image as ImageIcon, Link2, FlaskConical, SlidersHorizontal,
  Play, CheckCircle2, Circle, LayoutGrid,
  Gift, Target, Copy, ExternalLink, RotateCcw, Lock
} from "lucide-react";

// ─── Overlay card icon map ──────────────────────────
const iconMap: Record<string, React.ElementType> = {
  "layout-grid": LayoutGrid,
  gift: Gift,
  target: Target,
};

// ─── Category accent colors ─────────────────────────
const CATEGORY_ACCENT: Record<string, string> = {
  alerts: "#7c3aed",
  goals: "#059669",
  chat: "#2563eb",
  events: "#d97706",
  graphics: "#db2777",
};

// ─── Convert registry module to gallery card data ────
function moduleToCard(mod: any) {
  const meta = mod.metadata;
  return {
    id: mod.id,
    name: mod.name,
    description: mod.description,
    category: mod.category,
    tags: mod.tags ?? [],
    isPremium: meta?.premium ?? false,
    isNew: meta?.beta ?? false,
    isPopular: meta?.featured ?? false,
    module: mod,
    config: mod.defaultConfig ?? {},
  };
}

// ─── Overlay Gallery ─────────────────────────────────
export function OverlayGallery() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string>("coin-jar-pro");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const demoRef = useRef<ReturnType<typeof createCoinJarDemoEventSource> | null>(null);
  const testIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { plan, canAccessTier } = useLicenseStore();
  const isPro = plan === 'pro';

  // Look up overlay instances from the store (same source as CustomizePage)
  const allModules = useMemo(() => {
    const mods = getOverlayModules();
    console.log('[OVERLAY-TRACE] gallery input count =', mods.length);
    console.log('[OVERLAY-TRACE] gallery input ids =', mods.map(m => m.id));
    console.log('[OVERLAY-TRACE] gallery has goal-progress =', mods.some(m => m.id === 'goal-progress'));
    return mods;
  }, []);
  const cards = useMemo(() => allModules.map(moduleToCard), [allModules]);

  console.log('[OVERLAY-TRACE] rendered cards count =', cards.length);
  console.log('[OVERLAY-TRACE] rendered card ids =', cards.map(c => c.id));

  const selected = useMemo(
    () => cards.find((c) => c.id === selectedId) ?? cards[0] ?? null,
    [cards, selectedId],
  );

  // Generate the exact same Browser Source URL that CoinJarEditor uses
  // Coin Jar Pro: /coin-jar.html  |  Goal Progress: /goals-widget.html
  // Both served by the local SSE server on port 18890.
  const browserSourceUrl = useMemo(() => {
    const isGoalModule = selected?.id === 'goal-progress' || selected?.id === 'goal-likes' || selected?.id === 'goal-followers' || selected?.id === 'goal-gifts';
    if (isGoalModule) {
      const url = `${getSSEBaseUrl()}/goals-widget.html`;
      console.log('[OVERLAY-LOCAL] Gallery using LOCAL URL for goal module:', selected?.id, url);
      return url;
    }
    const localUrl = getOverlayWidgetUrl().replace('overlay-widget.html', 'coin-jar.html');
    console.log('[OVERLAY-LOCAL] Gallery using LOCAL URL for', selected?.id, ':', localUrl);
    return localUrl;
  }, [selected]);

  // Stable demo event source — create once per session
  useEffect(() => {
    demoRef.current = createCoinJarDemoEventSource();
  }, []);

  // Cleanup test simulation on unmount
  useEffect(() => {
    return () => {
      if (testIntervalRef.current) {
        clearInterval(testIntervalRef.current);
        testIntervalRef.current = null;
      }
    };
  }, []);

  // ── Copy URL ────────────────────────────────────────
  const handleCopyUrl = useCallback(() => {
    if (!browserSourceUrl) return;
    navigator.clipboard.writeText(browserSourceUrl).then(
      () => {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      },
      () => {
        // Fallback: select text
        const ta = document.createElement("textarea");
        ta.value = browserSourceUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      },
    );
  }, [browserSourceUrl]);

  // ── Test goal progress: simulate 0 → target over ~7 seconds ──
  const handleTest = useCallback(() => {
    if (selected?.id === 'goal-progress') {
      // Cancel any running simulation
      if (testIntervalRef.current) {
        clearInterval(testIntervalRef.current);
        testIntervalRef.current = null;
      }

      const cfg = selected?.config ?? {};
      const target = (cfg.target as number) ?? 7000;
      const goalType = (cfg.goalType as string) ?? 'likes';
      const title = (cfg.title as string) ?? 'Goal';
      const barColor = (cfg.barColor as string) ?? '#8b5cf6';
      const reachedBehavior = (cfg.reachedBehavior as string) ?? 'increase';
      const actionId = (cfg.actionId as string) ?? null;

      // Calculate animation steps: ~80 steps, capped for performance
      const steps = Math.min(80, Math.max(20, target));
      const stepDuration = Math.max(60, Math.round(7000 / steps));
      const increment = target / steps;
      let step = 0;

      // Broadcast initial state at 0
      sendToOverlay({
        type: 'goal-progress', current: 0, target, goalType, title, barColor,
      } as any);

      testIntervalRef.current = setInterval(() => {
        step++;
        const isLast = step >= steps;
        const current = isLast ? target : Math.min(target, Math.round(increment * step));

        // Broadcast progress to preview + browser source
        sendToOverlay({
          type: 'goal-progress', current, target, goalType, title, barColor,
        } as any);

        if (isLast && testIntervalRef.current) {
          clearInterval(testIntervalRef.current);
          testIntervalRef.current = null;

          // Execute action on reaching (once)
          console.log('[GOAL-COMPLETE] target reached:', { target, actionId });
          if (actionId) {
            const actions = useAppStore.getState().actions;
            const action = actions.find((a) => a.id === actionId);
            console.log('[GOAL-ACTION] lookup:', { actionId, found: !!action, actionName: action?.name, enabled: action?.enabled, totalActions: actions.length });
            if (action && action.enabled) {
              try {
                console.log('[GOAL-ACTION] executing:', action.name);
                executeAction(action, {
                  type: 'goal-reached', user: 'Test', goalTitle: title,
                  goalType, timestamp: Date.now(),
                });
                console.log('[GOAL-ACTION] execution started');
              } catch (err) {
                console.error('[GOAL-ACTION] execution error:', err);
              }
            } else {
              console.warn('[GOAL-ACTION] action not found or disabled:', { actionId, found: !!action });
            }
          } else {
            console.log('[GOAL-TEST] no actionId configured');
          }

          // Apply "When Reached" behavior
          const goals = useGoalStore.getState().goals;
          const goal = goals.find((g) => g.enabled);
          if (goal) {
            if (reachedBehavior === 'increase') {
              const overshoot = Math.max(0, target - goal.target);
              const newTarget = goal.target + goal.target;
              useGoalStore.getState().updateGoal(goal.id, { target: newTarget });
              useGoalStore.getState().updateRuntime(goal.id, {
                current: overshoot, reached: false, lastCompletedTarget: 0,
              });
              useGoalStore.getState().broadcastGoalProgress(goal.id);
            } else if (reachedBehavior === 'double') {
              useGoalStore.getState().updateGoal(goal.id, { target: goal.target * 2 });
              useGoalStore.getState().updateRuntime(goal.id, {
                current: 0, reached: false, lastCompletedTarget: 0,
              });
              useGoalStore.getState().broadcastGoalProgress(goal.id);
            }
          }
        }
      }, stepDuration);
      return;
    }
    const w = window as any;
    if (w.__coinJarProTest) {
      w.__coinJarProTest();
    } else if (w.__coinJarProRealGiftTest) {
      w.__coinJarProRealGiftTest({
        giftName: "Rose",
        diamonds: 10,
        repeatCount: 1,
        username: "Test User",
      });
    }
  }, [selected]);

  // ── Customize ───────────────────────────────────────
  const handleCustomize = useCallback(() => {
    console.log('[GOAL-PROGRESS] handleCustomize called, selected:', selected?.id);
    if (selected?.id === "coin-jar-pro") {
      navigate("/overlays/coin-jar");
    } else if (selected?.id === "goal-progress" || selected?.id === "goal-likes" || selected?.id === "goal-followers" || selected?.id === "goal-gifts") {
      navigate(`/customize/${selected.id}`);
    }
  }, [selected, navigate]);

  // ── Copy URL button label ───────────────────────────
  const copyLabel = copiedUrl ? "Copied!" : "Copy URL";
  const copyIcon = copiedUrl ? CheckCircle2 : Copy;

  return (
    <div className="flex h-full bg-[#09090b]">
      {/* ── Left Sidebar: Overlay List ──────────────── */}
      <aside className="w-[280px] shrink-0 border-r border-white/[0.06] flex flex-col bg-[#0c0c0e]">
        {/* Header */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <LayoutGrid className="w-4 h-4 text-primary-light" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Overlay Gallery
              </h1>
              <p className="text-[11px] text-white/40 leading-snug">
                Browse, preview &amp; manage your overlays
              </p>
            </div>
          </div>
        </div>

        {/* Overlay list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
          {cards.map((card) => {
            const active = card.id === selectedId;
            const accent = CATEGORY_ACCENT[card.category] ?? "#7c3aed";
            return (
              <button
                key={card.id}
                onClick={() => setSelectedId(card.id)}
                className={cn(
                  "w-full text-left rounded-xl p-3 transition-all duration-200 border",
                  active
                    ? "bg-white/[0.06] border-primary/40 shadow-[0_0_20px_rgba(124,58,237,0.12)]"
                    : "bg-white/[0.02] border-transparent hover:bg-white/[0.04] hover:border-white/[0.08]",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${accent}22`, border: `1px solid ${accent}33` }}
                  >
                    {(() => {
                      const Icon = iconMap[card.category] ?? Target;
                      return <Icon className="w-4 h-4" style={{ color: accent }} />;
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-sm font-semibold truncate",
                          active ? "text-white" : "text-white/70",
                        )}
                      >
                        {card.name}
                      </span>
                      {card.isPremium ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          PRO
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          FREE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/35 truncate leading-snug mt-0.5">
                      {card.description}
                    </p>
                  </div>
                  {active && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────── */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {selected ? (
          <>
            {/* ── Info Bar ─────────────────────────── */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-white/[0.04] shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                    {selected.isPremium ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        PRO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        FREE
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-white/40 mt-1 max-w-xl leading-relaxed">
                    {selected.description}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Live Preview ──────────────────────── */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-6 pt-4 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                    Live Preview
                  </span>
                </div>
              </div>

              <div className="flex-1 min-h-0 mx-6 mb-4 flex items-center justify-center rounded-2xl bg-[#050505] border border-white/[0.06] overflow-hidden">
                <Suspense
                  fallback={
                    <div className="flex flex-col items-center gap-3 text-white/30">
                      <RotateCcw className="w-6 h-6 animate-spin" />
                      <span className="text-xs">Loading overlay…</span>
                    </div>
                  }
                >
                  {selected.module?.renderer ? (
                    <div className="w-full h-full flex items-center justify-center overflow-hidden">
                      {(() => {
                        const Renderer = selected.module.renderer;
                        const events =
                          selected.id === "coin-jar-pro"
                            ? demoRef.current
                            : undefined;
                        if (selected.id === "coin-jar-pro") {
                          console.log('[OVERLAY-GALLERY] passing demo events to renderer:', !!events, 'demoRef:', !!demoRef.current);
                        }
                        return (
                          <Renderer
                            config={selected.config}
                            mode="preview"
                            events={events}
                            size={{ width: 400, height: 500 }}
                          />
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-center px-8">
                      <Play className="w-10 h-10 text-white/10 mx-auto mb-3" />
                      <p className="text-sm font-medium text-white/50">
                        {selected.name}
                      </p>
                      <p className="text-xs text-white/25 mt-1">
                        Preview not available
                      </p>
                    </div>
                  )}
                </Suspense>
              </div>
            </div>

            {/* ── Action Bar ────────────────────────── */}
            <div className="px-6 py-4 border-t border-white/[0.04] flex items-center gap-3 shrink-0">
              {/* RosaeFinity Official label */}
              <div className="flex items-center gap-2 mr-auto">
                <div className="w-6 h-6 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <ImageIcon className="w-3 h-3 text-primary-light" />
                </div>
                <span className="text-xs font-semibold text-white/50">
                  RosaeFinity Official
                </span>
              </div>

              {/* Pro lock indicator for Coin Jar Pro */}
              {selected.isPremium && !isPro && (
                <div className="flex items-center gap-1.5 mr-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium">
                  <Lock className="w-3 h-3" />
                  PRO FEATURE
                </div>
              )}

              {/* Copy URL */}
              <button
                onClick={() => {
                  if (selected.isPremium && !isPro) {
                    setUpgradeDialogOpen(true);
                    return;
                  }
                  handleCopyUrl();
                }}
                className={cn(
                  "flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-medium transition-all border",
                  copiedUrl
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : selected.isPremium && !isPro
                    ? "bg-white/[0.04] border-white/[0.08] text-white/40 cursor-not-allowed opacity-60"
                    : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15]",
                )}
                disabled={selected.isPremium && !isPro}
              >
                {(() => {
                  const Icon = copyIcon;
                  return <Icon className="w-3.5 h-3.5" />;
                })()}
                {copyLabel}
              </button>

              {/* Test */}
              <button
                onClick={(e) => {
                  // TEMPORARY: elementFromPoint diagnostic
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  const topEl = document.elementFromPoint(cx, cy);
                  console.log('[GOAL-PROGRESS-CLICK] Test button center:', cx, cy, 'top element:', topEl?.tagName, topEl?.textContent?.trim()?.slice(0, 30), 'isSelf:', topEl === e.currentTarget || topEl?.closest?.('button') === e.currentTarget);

                  if (selected.isPremium && !isPro) {
                    setUpgradeDialogOpen(true);
                    return;
                  }
                  handleTest();
                }}
                className={cn(
                  "flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-medium transition-all border",
                  selected.isPremium && !isPro
                    ? "bg-white/[0.04] border-white/[0.08] text-white/40 cursor-not-allowed opacity-60"
                    : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15]",
                )}
                disabled={selected.isPremium && !isPro}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Test
              </button>

              {/* Customize */}
              <button
                onClick={() => {
                  if (selected.isPremium && !isPro) {
                    setUpgradeDialogOpen(true);
                    return;
                  }
                  handleCustomize();
                }}
                className={cn(
                  "flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-semibold transition-all border",
                  selected.isPremium && !isPro
                    ? "bg-primary/10 border-primary/20 text-primary/40 cursor-not-allowed opacity-60"
                    : "bg-primary/20 border-primary/30 text-primary-light hover:bg-primary/30",
                )}
                disabled={selected.isPremium && !isPro}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Customize
              </button>

              {/* Upgrade Dialog */}
              <UpgradeDialog
                open={upgradeDialogOpen}
                onClose={() => setUpgradeDialogOpen(false)}
                reason="feature_locked"
              />
            </div>
          </>
        ) : (
          /* ── Empty state ──────────────────────────── */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <Play className="w-7 h-7 text-white/15" />
              </div>
              <p className="text-sm font-medium text-white/40 mb-1">
                Select an overlay
              </p>
              <p className="text-xs text-white/25">
                Choose an overlay from the list to see a live preview
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default OverlayGallery;
