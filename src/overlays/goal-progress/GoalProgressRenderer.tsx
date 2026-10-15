// =============================================
// RosaeFinity — Goal Progress Overlay Renderer
// Premium livestream overlay with glow, particles,
// animated progress, and tier-responsive visual energy.
// =============================================

import React, { useEffect, useMemo, useState, useRef, useCallback, memo } from "react";
import type { GoalProgressConfig } from "./types";
import type { RendererProps, OverlayEvent } from "../types";
import { overlayDebugLog } from "../../lib/overlay-debug";

// ─── Injected CSS Keyframes (once, globally) ────────────────
const STYLE_ID = "goal-progress-overlay-styles";

const INJECTED_STYLES = `
  @keyframes goal-shine-sweep {
    0%   { transform: translateX(-100%) skewX(-20deg); }
    100% { transform: translateX(400%) skewX(-20deg); }
  }
  @keyframes goal-pct-pulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.05); }
  }
  @keyframes goal-glow-breathe {
    0%, 100% { opacity: 0.5; }
    50%      { opacity: 0.85; }
  }
  @keyframes goal-icon-pulse {
    0%   { transform: scale(1); }
    35%  { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  @keyframes goal-icon-breathe {
    0%, 100% { opacity: 0.75; filter: drop-shadow(0 0 4px var(--gp-color) ); }
    50%      { opacity: 1;    filter: drop-shadow(0 0 10px var(--gp-color)); }
  }
  @keyframes goal-float {
    0%   { transform: translateY(0) translateX(0);     opacity: 0; }
    15%  { opacity: 0.8; }
    85%  { opacity: 0.8; }
    100% { transform: translateY(-90px) translateX(var(--drift)); opacity: 0; }
  }
  @keyframes goal-celebrate {
    0%   { transform: scale(1);   filter: brightness(1); }
    25%  { transform: scale(1.08); filter: brightness(1.3); }
    100% { transform: scale(1);   filter: brightness(1); }
  }
  @keyframes goal-burst {
    0%   { transform: translate(0, 0) scale(1);   opacity: 1; }
    100% { transform: translate(var(--bx), var(--by)) scale(0.2); opacity: 0; }
  }
  @keyframes goal-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes goal-text-fade {
    0%   { opacity: 0; transform: translateY(4px); }
    100% { opacity: 1; transform: translateY(0); }
  }
`;

// ─── SVG Icons (self-contained, no external dependencies) ───

function HeartIcon({ color }: { color: string }): React.JSX.Element {
  const id = `gpi-h-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={lighten(color, 45)} />
        </linearGradient>
      </defs>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
           2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3
           19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={`url(#${id})`}
        stroke={color}
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />
    </svg>
  );
}

function FollowerIcon({ color }: { color: string }): React.JSX.Element {
  const id = `gpi-f-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={lighten(color, 45)} />
        </linearGradient>
      </defs>
      <path
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill={`url(#${id})`}
        stroke={color}
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />
    </svg>
  );
}

function GiftIcon({ color }: { color: string }): React.JSX.Element {
  const id = `gpi-g-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={lighten(color, 45)} />
        </linearGradient>
      </defs>
      <path
        d="M20 6h-2.18c.11-.31.18-.65.18-1a3 3 0 0 0-3-3c-1.05 0-1.98.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.03 2 9 2a3 3 0 0 0-3 3c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 12 7.4l3.38 4.6L17 10.83 14.92 8H20v6z"
        fill={`url(#${id})`}
        stroke={color}
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />
    </svg>
  );
}

function GoalIcon({ goalType, color }: { goalType: string; color: string }): React.JSX.Element {
  switch (goalType) {
    case "likes": return <HeartIcon color={color} />;
    case "followers": return <FollowerIcon color={color} />;
    case "gifts": return <GiftIcon color={color} />;
    default: return <HeartIcon color={color} />;
  }
}

// ─── Color helpers ──────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const num = parseInt(h, 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function tierGlowOpacity(tier: number): number {
  switch (tier) {
    case 1: return 0.35;
    case 2: return 0.55;
    case 3: return 0.7;
    case 4: return 0.85;
    case 5: return 1;
    default: return 0.35;
  }
}

function tierGlowBlur(tier: number): number {
  switch (tier) {
    case 1: return 8;
    case 2: return 12;
    case 3: return 16;
    case 4: return 20;
    case 5: return 24;
    default: return 8;
  }
}

function motivationalText(pct: number): string {
  if (pct >= 100) return "GOAL COMPLETE!";
  if (pct >= 75) return "ALMOST THERE!";
  if (pct >= 50) return "HALFWAY THERE!";
  if (pct >= 25) return "KEEP IT GOING!";
  return "LET'S GO!";
}

// ─── Floating particles ─────────────────────────────────────

interface FloatingParticle {
  key: string;
  left: string;
  size: number;
  animDuration: string;
  animDelay: string;
  drift: string;
  color: string;
  shape: "circle" | "diamond";
  opacity: number;
}

function generateFloatingParticles(
  count: number,
  barColor: string,
): FloatingParticle[] {
  if (count <= 0) return [];
  const particles: FloatingParticle[] = [];
  for (let i = 0; i < count; i++) {
    const seed = ((i + 1) * 7919) % 1000;
    particles.push({
      key: `fp-${i}-${seed}`,
      left: `${(seed * 3.7) % 100}%`,
      size: 2 + (seed % 3),
      animDuration: `${4 + (seed % 5)}s`,
      animDelay: `${(seed % 40) / 10}s`,
      drift: `${((seed % 40) - 20)}px`,
      color: barColor,
      shape: seed % 3 === 0 ? "diamond" : "circle",
      opacity: 0.2 + ((seed % 30) / 100),
    });
  }
  return particles;
}

// ─── Main Renderer ──────────────────────────────────────────

function GoalProgressRendererImpl({
  config,
  mode,
  events,
  instanceId,
}: RendererProps<GoalProgressConfig> & { instanceId?: string }): React.JSX.Element {
  overlayDebugLog('[PREVIEW-RUNTIME-2]', JSON.stringify({
    textColor: config?.textColor,
    barColor: config?.barColor,
    gradientColor: config?.gradientColor,
    backgroundColor: config?.backgroundColor,
    title: config?.title,
    goalType: config?.goalType
  }, null, 2));

  // ─── Runtime DOM style logging ───
  useEffect(() => {
    if (typeof document === "undefined") return;
    // Wait a frame for the DOM to be painted
    requestAnimationFrame(() => {
      const root = document.querySelector('.goal-gp-content');
      if (!root) return;

      // Text element (title + numbers)
      const textEl = root.querySelector('[style*="color:"][style*="fontWeight: 800"]') ||
                     root.querySelector('[style*="color:"][style*="fontSize: clamp(20px"]');

      // Progress bar fill
      const progressEl = root.querySelector('[style*="linear-gradient"][style*="width:"]');

      // Glow element
      const glowEl = root.querySelector('[style*="blur("][style*="background:"]');

      // Percentage text
      const pctEl = root.querySelector('[style*="fontWeight: 900"][style*="textAlign: center"]');

      overlayDebugLog('[PREVIEW-RUNTIME-3]', JSON.stringify({
        textColor: textEl ? getComputedStyle(textEl).color : 'NOT_FOUND',
        progressBackground: progressEl ? getComputedStyle(progressEl).background : 'NOT_FOUND',
        progressBackgroundColor: progressEl ? getComputedStyle(progressEl).backgroundColor : 'NOT_FOUND',
        glowBackground: glowEl ? getComputedStyle(glowEl).background : 'NOT_FOUND',
        glowBoxShadow: glowEl ? getComputedStyle(glowEl).boxShadow : 'NOT_FOUND',
        glowFilter: glowEl ? getComputedStyle(glowEl).filter : 'NOT_FOUND',
        pctColor: pctEl ? getComputedStyle(pctEl).color : 'NOT_FOUND',
        pctBackground: pctEl ? getComputedStyle(pctEl).background : 'NOT_FOUND',
      }, null, 2));
    });
  }, [config.barColor, config.gradientColor, config.textColor, config.backgroundColor]);
  // Runtime goal-state fields — present on instance-based goal configs
  // (GoalInstanceConfig) but absent on the legacy goal-progress config type.
  const runtimeCfg = config as unknown as { current?: number; reached?: boolean };
  const [current, setCurrent] = useState(() =>
    typeof runtimeCfg.current === 'number' ? runtimeCfg.current : 0,
  );
  const [reached, setReached] = useState(() => runtimeCfg.reached === true);
  const [pulsing, setPulsing] = useState(false);
  const [justReached, setJustReached] = useState(false);

  // [GOAL-RENDERER-FORENSIC] Temporary diagnostics — which state key each
  // goal renderer displays, and whether the per-instance event filter is active.
  // [GOAL-INITIAL-RENDER-FORENSIC] — Task 9: value BEFORE any SSE event.
  useEffect(() => {
    const cfgCurrent = typeof runtimeCfg.current === 'number' ? runtimeCfg.current : 0;
    if (overlayDebugEnabled()) {
      console.log('[GOAL-RENDERER-FORENSIC]', JSON.stringify({
        phase: 'mount',
        instanceId: instanceId ?? null,
        goalType: (config as any)?.goalType ?? null,
        current: cfgCurrent,
        target: (config as any)?.target ?? null,
        sourceStateKey: 'instanceConfig.current (config prop)',
        filterActive: Boolean(instanceId),
      }));
      console.log('[GOAL-INITIAL-RENDER-FORENSIC]', JSON.stringify({
        instanceId: instanceId ?? null,
        moduleId: (config as any)?.goalType ?? null,
        configCurrent: cfgCurrent,
        configTarget: (config as any)?.target ?? null,
        displayCurrent: mode === 'preview' ? Math.floor(((config as any)?.target ?? 0) * 0.35) : cfgCurrent,
        source: 'config-prop-at-mount (upstream of any SSE)',
      }));
    }
  }, [instanceId, config, mode]);

  // Hydrate from persisted instance config — renderer reload / SSE reconnect
  // must NOT visually reset goal progress (state lives in instance config).
  useEffect(() => {
    if (typeof runtimeCfg.current === 'number' && runtimeCfg.current > 0) {
      setCurrent(runtimeCfg.current);
    }
    if (runtimeCfg.reached) setReached(true);
  }, [runtimeCfg.current, runtimeCfg.reached]);

  // Preview: show 35% unless a Test event set a non-zero value
  const previewCurrent = Math.floor(config.target * 0.35);
  const displayCurrent = mode === "preview"
    ? current > 0 ? current : previewCurrent
    : current;

  const target = config.target;
  const pct = target > 0 ? Math.min(100, (displayCurrent / target) * 100) : 0;
  const isReached = displayCurrent >= target;

  // Hide overlay when goal is reached and behavior is 'hide'
  if (reached && config.reachedBehavior === 'hide') {
    return <div style={{ width: '100%', height: '100%', background: 'transparent' }} />;
  }

  // ── SSE / events subscription ──
  useEffect(() => {
    if (!events) return;
    const unsub = events.subscribe((event: OverlayEvent) => {
      if (event.type === "goal-progress") {
        // Per-instance isolation: accept only events whose goalId matches THIS
        // renderer's overlay instance (or the legacy goal-store association
        // stored in config.goalId). Other Goal instances' events are ignored —
        // multiple Goal browser sources coexist in the same LIVE.
        const eventGoalId = (event as any).goalId ?? null;
        const legacyGoalId = (config as any)?.goalId ?? null;
        let filterDecision: string;
        if (!instanceId) {
          filterDecision = 'ACCEPTED-NO-INSTANCEID-FILTER-INACTIVE';
        } else if (eventGoalId === instanceId) {
          filterDecision = 'ACCEPT';
        } else if (legacyGoalId && eventGoalId === legacyGoalId) {
          filterDecision = 'ACCEPT-LEGACY-GOALID-ASSOC';
        } else if (eventGoalId) {
          filterDecision = 'IGNORE-INSTANCE-MISMATCH';
        } else {
          // Event without goalId cannot be attributed — apply only when we
          // have no instance identity to enforce (legacy behavior).
          filterDecision = instanceId ? 'IGNORE-NO-GOALID' : 'ACCEPTED-NO-INSTANCEID-FILTER-INACTIVE';
        }
        // [GOAL-INSTANCE-FORENSIC] / [GOAL-RENDERER-FORENSIC] diagnostics
        if (overlayDebugEnabled()) {
          console.log('[GOAL-INSTANCE-FORENSIC]', JSON.stringify({
            instanceId: instanceId ?? null,
            moduleId: (config as any)?.goalType ?? null,
            eventGoalId,
            current: event.current,
            filterDecision,
          }));
          console.log('[GOAL-RENDERER-FORENSIC]', JSON.stringify({
            phase: 'sse-goal-progress',
            instanceId: instanceId ?? null,
            goalType: (config as any)?.goalType ?? null,
            eventGoalId,
            eventCurrent: event.current,
            filterDecision,
            previousCurrent: current,
          }));
        }
        if (filterDecision.startsWith('IGNORE')) return;
        setCurrent(event.current);
        if ((event as any).reached) setReached(true);
      }
      if (event.type === "custom" && (event as any).data?.type === "goal-progress") {
        if (instanceId && (event as any).data?.goalId && (event as any).data.goalId !== instanceId) return;
        setCurrent((event as any).data.current ?? 0);
        if ((event as any).data?.reached) setReached(true);
      }
    });
    return unsub;
  }, [events, instanceId]);

  // ── BroadcastChannel (preview Test button + cross-tab) ──
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "goal-progress") {
        if (instanceId && e.data.goalId && e.data.goalId !== instanceId) return;
        setCurrent(e.data.current ?? 0);
        if (e.data.reached) setReached(true);
      }
    };
    try {
      const ch = new BroadcastChannel("rosaefinity-overlay");
      ch.onmessage = handler;
      return () => ch.close();
    } catch {
      return undefined;
    }
  }, [instanceId]);

  // ── Inject keyframes once ──
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = INJECTED_STYLES;
    document.head.appendChild(el);
  }, []);

  // ── Icon pulse on value change ──
  useEffect(() => {
    if (mode !== "browser-source" || current === 0) return;
    setPulsing(true);
    const t = setTimeout(() => setPulsing(false), 400);
    return () => clearTimeout(t);
  }, [current, mode]);

  // ── Goal-reached celebration ──
  useEffect(() => {
    if (!isReached) { setJustReached(false); return; }
    setJustReached(true);
    const t = setTimeout(() => setJustReached(false), 1200);
    return () => clearTimeout(t);
  }, [isReached]);

  // ── Visual tier (1-5) derived from progress ──
  const visualTier = useMemo(() => {
    if (pct >= 100) return 5;
    if (pct >= 75) return 4;
    if (pct >= 50) return 3;
    if (pct >= 25) return 2;
    return 1;
  }, [pct]);

  const particleCount = useMemo(() => {
    switch (visualTier) {
      case 1: return 0;
      case 2: return 3;
      case 3: return 5;
      case 4: return 7;
      case 5: return justReached ? 16 : 8;
      default: return 0;
    }
  }, [visualTier, justReached]);

  const floatingParticles = useMemo(
    () => generateFloatingParticles(particleCount, config.barColor),
    [particleCount, config.barColor],
  );

  // ── Burst particles for celebration (center → outward) ──
  const burstParticles = useMemo(() => {
    if (!justReached) return [];
    const n = 16;
    const items: Array<{
      key: string; bx: string; by: string; color: string; size: number;
    }> = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * 2 * Math.PI;
      const dist = 60 + (((i * 7919) % 80));
      items.push({
        key: `bp-${i}`,
        bx: `${Math.cos(angle) * dist}px`,
        by: `${Math.sin(angle) * dist}px`,
        color: i % 2 === 0 ? config.barColor : lighten(config.barColor, 60),
        size: 3 + (i % 3),
      });
    }
    return items;
  }, [justReached, config.barColor]);

  // ── Type label ──
  const typeLabel = config.goalType === "likes"
    ? "LIKES"
    : config.goalType === "followers"
      ? "FOLLOWERS"
      : "COINS";

  // ── Glow computed values ──
  const glowOpacity = tierGlowOpacity(visualTier);
  const glowBlur = tierGlowBlur(visualTier);

  // ── Pulse duration speeds up at higher tiers ──
  const pulseDuration = visualTier >= 4 ? "2s" : visualTier >= 3 ? "2.4s" : "2.8s";

  // ── Motivational text opacity scales with tier ──
  const textGlowOpacity = Math.min(1, 0.5 + visualTier * 0.12);

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        background: config.backgroundColor,
        position: "relative",
      }}
    >
      <div
        className="goal-gp-content"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "clamp(320px, 85cqw, 480px)",
          position: "relative",
        }}
      >
        {/* ── Celebration burst (100% achievement) ── */}
        {justReached && burstParticles.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            {burstParticles.map((bp) => (
              <div
                key={bp.key}
                style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  width: bp.size, height: bp.size,
                  borderRadius: "50%",
                  backgroundColor: bp.color,
                  boxShadow: `0 0 6px ${bp.color}`,
                  "--bx": bp.bx,
                  "--by": bp.by,
                  animation: "goal-burst 1.4s cubic-bezier(0.22,1,0.36,1) forwards",
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        {/* ── Floating particles (tiers 2+) ── */}
        {floatingParticles.map((p) => (
          <div
            key={p.key}
            style={{
              position: "absolute",
              bottom: "10%",
              left: p.left,
              width: p.size, height: p.size,
              borderRadius: p.shape === "diamond" ? "1px" : "50%",
              backgroundColor: p.color,
              opacity: p.opacity,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              "--drift": p.drift,
              animation: `goal-float ${p.animDuration} ease-in-out ${p.animDelay} infinite`,
              pointerEvents: "none",
            } as React.CSSProperties}
          />
        ))}

        {/* ═══ HEADER ═══ */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "clamp(8px, 2cqw, 14px)",
          }}
        >
          {/* Icon + title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "clamp(6px, 1.5cqw, 10px)",
              color: config.textColor,
              fontSize: "clamp(14px, 3cqw, 22px)",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              textShadow: `0 2px 8px rgba(0,0,0,0.7), 0 0 20px ${config.barColor}44`,
              lineHeight: 1,
              "--gp-color": config.barColor,
            } as React.CSSProperties}
          >
            <span
              style={{
                display: "inline-flex",
                fontSize: "1.25em",
                lineHeight: 1,
                filter: `drop-shadow(0 0 8px ${config.barColor}88)`,
                animation: pulsing
                  ? "goal-icon-pulse 400ms ease-out"
                  : "goal-icon-breathe 3s ease-in-out infinite",
              }}
            >
              <GoalIcon goalType={config.goalType} color={config.barColor} />
            </span>
            <span>{config.title.toUpperCase()}</span>
          </div>

          {/* Animated gradient accent line */}
          <div
            style={{
              marginTop: "clamp(5px, 1.2cqw, 9px)",
              width: "60%",
              height: 1,
              background: `linear-gradient(90deg, transparent, ${config.barColor}, transparent)`,
              backgroundSize: "200% 100%",
              animation: "goal-shimmer 3s linear infinite",
              opacity: 0.6 + visualTier * 0.08,
            }}
          />
        </div>

        {/* ═══ GOAL NUMBERS (hierarchical) ═══ */}
        {config.showNumbers && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "clamp(10px, 2.5cqw, 18px)",
              lineHeight: 1,
            }}
          >
            {/* Current value — dominant */}
            <div
              style={{
                fontSize: "clamp(20px, 4.8cqw, 34px)",
                fontWeight: 800,
                color: config.textColor,
                textShadow: `0 0 16px ${config.barColor}66, 0 2px 6px rgba(0,0,0,0.7)`,
                letterSpacing: "0.02em",
              }}
            >
              {displayCurrent.toLocaleString()}
            </div>
            {/* Target + type label — secondary */}
            <div
              style={{
                fontSize: "clamp(11px, 2.2cqw, 16px)",
                fontWeight: 400,
                color: config.textColor,
                opacity: 0.55,
                marginTop: "clamp(2px, 0.6cqw, 5px)",
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                letterSpacing: "0.05em",
              }}
            >
              / {target.toLocaleString()} {typeLabel}
            </div>
          </div>
        )}

        {/* ═══ PROGRESS BAR — The visual centerpiece ═══ */}
        <div
          style={{
            position: "relative",
            width: "100%",
            marginBottom: "clamp(6px, 1.5cqw, 12px)",
          }}
        >
          {/* A. Ambient glow halo (blurred behind bar) */}
          <div
            style={{
              position: "absolute",
              top: "-6px", bottom: "-6px",
              left: "0",
              width: `${pct}%`,
              borderRadius: "9999px",
              background: config.barColor,
              filter: `blur(${glowBlur}px)`,
              opacity: glowOpacity,
              transition: "width 700ms cubic-bezier(0.22,1,0.36,1), opacity 1s ease, filter 1s ease",
              animation: "goal-glow-breathe 3s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />

          {/* B. Track */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "clamp(20px, 3.8cqw, 28px)",
              borderRadius: "9999px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            {/* C. Fill */}
            <div
              style={{
                position: "absolute",
                top: 0, bottom: 0, left: 0,
                width: `${pct}%`,
                borderRadius: "9999px",
                transition: "width 700ms cubic-bezier(0.22,1,0.36,1)",
                background: isReached
                  ? "linear-gradient(90deg, #22c55e, #4ade80, #22c55e)"
                  : `linear-gradient(90deg, ${config.barColor}, ${config.gradientColor})`,
                boxShadow: `0 0 14px ${isReached ? "#22c55e" : config.barColor}77, inset 0 1px 0 rgba(255,255,255,0.25)`,
                overflow: "hidden",
              }}
            >
              {/* Inner top highlight (glass reflection) */}
              <div
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0,
                  height: "40%",
                  borderRadius: "9999px 9999px 0 0",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 100%)",
                  pointerEvents: "none",
                }}
              />

              {/* Shine sweep animation */}
              <div
                style={{
                  position: "absolute",
                  top: 0, bottom: 0,
                  left: 0,
                  width: "25%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
                  animation: "goal-shine-sweep 2.5s ease-in-out 1s infinite",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        </div>

        {/* ═══ PERCENTAGE ═══ */}
        {config.showPercentage && (
          <div
            style={{
              fontSize: "clamp(24px, 5.2cqw, 42px)",
              fontWeight: 900,
              textAlign: "center",
              color: config.textColor,
              textShadow: `0 0 20px ${config.barColor}44, 0 0 40px ${config.barColor}22, 0 2px 4px rgba(0,0,0,0.7)`,
              marginBottom: "clamp(4px, 1cqw, 8px)",
              lineHeight: 1,
              animation: `goal-pct-pulse ${pulseDuration} ease-in-out infinite`,
              transition: "text-shadow 1s ease",
            }}
          >
            {Math.round(pct)}%
          </div>
        )}

        {/* ═══ MOTIVATIONAL TEXT ═══ */}
        <div
          key={motivationalText(pct)}
          style={{
            fontSize: "clamp(10px, 2.2cqw, 15px)",
            fontWeight: 700,
            textAlign: "center",
            color: config.textColor,
            opacity: textGlowOpacity,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            textShadow: `0 0 ${8 + visualTier * 3}px ${config.barColor}44`,
            display: "flex",
            alignItems: "center",
            gap: "clamp(4px, 1cqw, 8px)",
            animation: "goal-text-fade 300ms ease-out forwards",
          }}
        >
          <span>{motivationalText(pct)}</span>
          {/* Accent diamond — neon period */}
          <span
            style={{
              display: "inline-block",
              width: "clamp(4px, 1cqw, 6px)",
              height: "clamp(4px, 1cqw, 6px)",
              backgroundColor: config.barColor,
              transform: "rotate(45deg)",
              boxShadow: `0 0 6px ${config.barColor}aa`,
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export const GoalProgressRenderer = memo(GoalProgressRendererImpl);
export default GoalProgressRenderer;
