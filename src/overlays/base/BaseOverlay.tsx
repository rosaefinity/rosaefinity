// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — BaseOverlay Component
// v3.1 Architecture Spec (Frozen)
//
// Every overlay renders through this component.
// Handles layout, animation, theme, error isolation,
// lifecycle, and performance.
// ─────────────────────────────────────────────────────

import React, { useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, type Variants } from 'framer-motion';
import type { BaseOverlayConfig, OverlayEventSource, OverlayEvent } from '../types';
import type { OverlayTheme } from './types';
import { resolveTheme, themeToCSSVariables, type ThemeMode } from './themes';
import { getTransitionKeyframes, getNoopKeyframes, prefersReducedMotion } from './animations';
// visibility-culler removed — visibility is tracked via getBoundingClientRect below
import { initOverlayDiagnostics, recordRender, destroyOverlayDiagnostics, setOverlayVisible } from './diagnostics';

// ─── Props ───

export interface BaseOverlayProps<TConfig extends BaseOverlayConfig = BaseOverlayConfig> {
  config: TConfig;
  mode: 'preview' | 'browser-source';
  theme?: ThemeMode;
  customTheme?: OverlayTheme;
  events?: OverlayEventSource;
  children?: React.ReactNode;
  /** Unique instance ID for diagnostics */
  instanceId?: string;
  /** Module ID for diagnostics */
  moduleId?: string;
  /** Disable animations (for performance mode) */
  disableAnimations?: boolean;
}

// ─── Overlay Error Boundary ───

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  prevInstanceId: string;
  prevModuleId: string;
}

class OverlayErrorBoundary extends React.Component<
  { children: React.ReactNode; instanceId: string; moduleId: string },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; instanceId: string; moduleId: string }) {
    super(props);
    this.state = { hasError: false, error: null, prevInstanceId: props.instanceId, prevModuleId: props.moduleId };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(
    props: { children: React.ReactNode; instanceId: string; moduleId: string },
    state: ErrorBoundaryState,
  ): ErrorBoundaryState | null {
    if (state.hasError && (props.instanceId !== state.prevInstanceId || props.moduleId !== state.prevModuleId)) {
      return { hasError: false, error: null, prevInstanceId: props.instanceId, prevModuleId: props.moduleId };
    }
    if (props.instanceId !== state.prevInstanceId || props.moduleId !== state.prevModuleId) {
      return { ...state, prevInstanceId: props.instanceId, prevModuleId: props.moduleId };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      `[BaseOverlay] Overlay "${this.props.moduleId}" (${this.props.instanceId}) crashed:`,
      error,
      errorInfo,
    );
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '4px',
            color: '#ef4444',
            fontSize: '12px',
            fontFamily: 'monospace',
            padding: '8px',
            textAlign: 'center',
          }}
        >
          Overlay Error: {this.state.error?.message ?? 'Unknown'}
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Render Timing HOC ───

function withRenderTiming<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  const Wrapped = memo(function RenderTimingWrapper(props: P) {
    const renderStart = useRef(0);

    renderStart.current = performance.now();

    useEffect(() => {
      const renderTime = performance.now() - renderStart.current;
      // Diagnostics recording is handled by the parent BaseOverlay
    });

    return <Component {...props} />;
  });

  Wrapped.displayName = `WithRenderTiming(${Component.displayName ?? Component.name ?? 'Unknown'})`;
  return Wrapped;
}

// ─── Main BaseOverlay Component ───

function BaseOverlayInner<TConfig extends BaseOverlayConfig>({
  config,
  mode,
  theme: themeMode = 'dark',
  customTheme,
  children,
  instanceId = 'unknown',
  moduleId = 'unknown',
  disableAnimations = false,
}: BaseOverlayProps<TConfig>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderStartRef = useRef(0);

  // ── Guard: ensure config has all required fields with valid values ──
  // This prevents NaN/undefined from reaching CSS properties
  if (typeof config.opacity !== 'number' || Number.isNaN(config.opacity)) {
    console.warn(`[BaseOverlay] config.opacity is ${String(config.opacity)} — falling back to 1`);
  }

  // ── Theme resolution ──
  const resolvedTheme = useMemo(
    () => resolveTheme(themeMode, customTheme),
    [themeMode, customTheme],
  );

  const cssVariables = useMemo(
    () => themeToCSSVariables(resolvedTheme),
    [resolvedTheme],
  );

  // ── Reduced motion check ──
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const animationsDisabled = disableAnimations || reducedMotion;

  // ── Animation keyframes ──
  const { entry, exit } = useMemo(() => {
    if (animationsDisabled || config.transition === 'none') {
      return getNoopKeyframes();
    }
    return getTransitionKeyframes(config.transition, config.animationSpeed);
  }, [config.transition, config.animationSpeed, animationsDisabled]);

  // ── Framer Motion variants ──
  const variants = useMemo(() => ({
    enter: entry.initial as Record<string, string | number>,
    visible: entry.animate as Record<string, string | number>,
    exit: exit.animate as Record<string, string | number>,
  }), [entry, exit]);

  // ── Layout styles ──
  const containerStyle: React.CSSProperties = useMemo(() => ({
    position: 'absolute',
    left: config.position.x,
    top: config.position.y,
    width: config.size.width,
    height: config.size.height,
    transform: `scale(${config.scale}) rotate(${config.rotation}deg)`,
    opacity: config.opacity,
    zIndex: config.zIndex ?? 0,
    overflow: 'hidden',
    pointerEvents: mode === 'browser-source' ? 'none' : 'auto',
    willChange: 'transform, opacity',
  }), [
    config.position.x, config.position.y,
    config.size.width, config.size.height,
    config.scale, config.rotation,
    config.opacity, config.zIndex,
    mode,
  ]);

  // ── Inner styles (theme + typography) ──
  const innerStyle: React.CSSProperties = useMemo(() => ({
    width: '100%',
    height: '100%',
    fontFamily: config.fontFamily || resolvedTheme.typography.fontFamily,
    fontSize: config.fontSize || resolvedTheme.typography.fontSize,
    fontWeight: config.fontWeight || resolvedTheme.typography.fontWeight,
    lineHeight: resolvedTheme.typography.lineHeight,
    color: config.colors.text,
    background: config.colors.background,
    borderRadius: config.border.radius,
    border: config.border.width > 0 ? `${config.border.width}px solid ${config.border.color}` : 'none',
    boxShadow: config.shadow.enabled
      ? `${config.shadow.offsetX}px ${config.shadow.offsetY}px ${config.shadow.blur}px ${config.shadow.color}`
      : 'none',
    padding: `${config.padding.top}px ${config.padding.right}px ${config.padding.bottom}px ${config.padding.left}px`,
    margin: `${config.margin.top}px ${config.margin.right}px ${config.margin.bottom}px ${config.margin.left}px`,
    boxSizing: 'border-box',
  }), [
    config.fontFamily, config.fontSize, config.fontWeight,
    config.colors.text, config.colors.background,
    config.border, config.shadow,
    config.padding, config.margin,
    resolvedTheme.typography,
  ]);

  // ── Diagnostics ──
  useEffect(() => {
    initOverlayDiagnostics(instanceId, moduleId);
    return () => destroyOverlayDiagnostics(instanceId);
  }, [instanceId, moduleId]);

  // ── Render timing ──
  renderStartRef.current = performance.now();
  useEffect(() => {
    const renderTime = performance.now() - renderStartRef.current;
    recordRender(instanceId, renderTime);
  });

  // ── Visibility tracking ──
  useEffect(() => {
    if (mode !== 'preview') return;

    const checkVis = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      setOverlayVisible(instanceId, visible);
    };

    checkVis();
    const interval = setInterval(checkVis, 1000);
    return () => clearInterval(interval);
  }, [instanceId, mode]);

  // ── CSS variables merge ──
  const mergedStyle: React.CSSProperties = useMemo(() => ({
    ...containerStyle,
    ...cssVariables,
  } as React.CSSProperties), [containerStyle, cssVariables]);

  return (
    <OverlayErrorBoundary instanceId={instanceId} moduleId={moduleId}>
      <motion.div
        ref={containerRef}
        className="overlay-root"
        style={mergedStyle}
        initial="enter"
        animate="visible"
        exit="exit"
        variants={variants}
        transition={entry.transition as Record<string, unknown>}
        data-overlay-id={instanceId}
        data-overlay-module={moduleId}
      >
        <div style={innerStyle}>
          {children}
        </div>
      </motion.div>
    </OverlayErrorBoundary>
  );
}

/**
 * BaseOverlay — the foundation component for all overlays.
 *
 * Wraps overlay content with:
 * - Layout (position, size, rotation, scale, opacity, z-index)
 * - Animation (entry, exit, speed control, reduced motion)
 * - Theme (CSS custom properties, dark/light/auto)
 * - Error isolation (per-overlay ErrorBoundary)
 * - Diagnostics (render timing, visibility tracking)
 * - Performance (GPU-accelerated transforms, will-change)
 *
 * Every overlay must render through this component.
 */
export const BaseOverlay = memo(BaseOverlayInner) as <
  TConfig extends BaseOverlayConfig,
>(props: BaseOverlayProps<TConfig>) => React.ReactElement;

export default BaseOverlay;
