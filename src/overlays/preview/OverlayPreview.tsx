// ─────────────────────────────────────────────────────
// RosaeFinity Overlay Preview — Main Preview Component
// Reusable overlay preview combining renderer, mock events, and performance
// ─────────────────────────────────────────────────────

import React, { memo, useMemo, useRef, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import type { AnyOverlayModule, RendererProps, OverlayEventSource, BaseOverlayConfig } from '../types';
import { PreviewRenderer } from './PreviewRenderer';
import { usePreviewContext } from './PreviewProvider';
import { createOverlayConfig } from '../createConfig';
import { usePreviewContainer, useRendererProps } from './previewHooks';

// ═══════════════════════════════════════════════════════
// OVERLAY PREVIEW PROPS
// ═══════════════════════════════════════════════════════

export interface OverlayPreviewProps {
  /** The overlay module to preview */
  module: AnyOverlayModule;
  /** Optional custom config (defaults to module.defaultConfig) */
  config?: BaseOverlayConfig;
  /** Preview container size */
  size?: { width: number; height: number };
  /** Custom event source (uses mock if not provided) */
  events?: OverlayEventSource;
  /** Override mock event interval */
  mockEventIntervalMs?: number;
  /** Disable mock events entirely */
  disableMockEvents?: boolean;
  /** Show overlay metadata badge */
  showBadge?: boolean;
  /** Aspect ratio constraint */
  aspectRatio?: '16:9' | '9:16' | '1:1' | 'auto';
  /** Container className */
  className?: string;
  /** Container style */
  style?: React.CSSProperties;
  /** Callback when preview mounts */
  onMount?: () => void;
  /** Callback when preview unmounts */
  onUnmount?: () => void;
  /** Enable performance monitoring */
  enablePerformanceMonitoring?: boolean;
}

/**
 * Default preview sizes by aspect ratio
 */
const ASPECT_RATIO_SIZES: Record<OverlayPreviewProps['aspectRatio'], { width: number; height: number }> = {
  '16:9': { width: 480, height: 270 },
  '9:16': { width: 270, height: 480 },
  '1:1': { width: 360, height: 360 },
  'auto': { width: 480, height: 280 },
};

// ═══════════════════════════════════════════════════════
// OVERLAY PREVIEW COMPONENT
// ═══════════════════════════════════════════════════════

export function OverlayPreviewInner({
  module,
  config,
  size: customSize,
  events: customEvents,
  mockEventIntervalMs,
  disableMockEvents = false,
  showBadge = false,
  aspectRatio = 'auto',
  className = '',
  style,
  onMount,
  onUnmount,
  enablePerformanceMonitoring = false,
}: OverlayPreviewProps): React.ReactElement {
  const { getEventSource, isPreviewVisible, registerPreview } = usePreviewContext();

  // Determine size based on aspect ratio or custom size
  const size = useMemo(() => {
    if (customSize) return customSize;
    return ASPECT_RATIO_SIZES[aspectRatio] ?? ASPECT_RATIO_SIZES.auto;
  }, [customSize, aspectRatio]);

  // Get mock events if not provided
  const mockEvents = useMemo(() => {
    if (disableMockEvents || customEvents) return customEvents;
    return getEventSource(module.metadata.id, mockEventIntervalMs);
  }, [module.metadata.id, customEvents, disableMockEvents, getEventSource, mockEventIntervalMs]);

  // Prepare renderer props
  const rendererProps = useMemo<RendererProps>(() => ({
    config: config ?? createOverlayConfig(module),
    mode: 'preview' as const,
    events: mockEvents,
    size,
  }), [config, module.defaultConfig, mockEvents, size]);

  // Track visibility for performance
  const { ref: containerRef, isVisible } = usePreviewContainer(module.metadata.id, {
    threshold: 0.1,
    rootMargin: '50px',
  });

  // Performance monitoring
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
  });
  const renderTimesRef = useRef<number[]>([]);
  const renderStartRef = useRef(0);

  // Handle render timing
  useEffect(() => {
    if (!enablePerformanceMonitoring) return;

    renderStartRef.current = performance.now();

    return () => {
      const renderTime = performance.now() - renderStartRef.current;
      renderTimesRef.current.push(renderTime);
      if (renderTimesRef.current.length > 50) {
        renderTimesRef.current.shift();
      }
      const avg = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;
      setMetrics((prev) => ({
        ...prev,
        renderCount: prev.renderCount + 1,
        lastRenderTime: renderTime,
        averageRenderTime: avg,
      }));
    };
  }, [enablePerformanceMonitoring]);

  // Mount/unmount callbacks
  useEffect(() => {
    onMount?.();
    return () => onUnmount?.();
  }, [onMount, onUnmount]);

  // Register with visibility tracking
  useEffect(() => {
    registerPreview(module.metadata.id, isVisible);
  }, [module.metadata.id, isVisible, registerPreview]);

  // Calculate container styles
  const containerStyle: React.CSSProperties = useMemo(() => ({
    width: size.width,
    height: size.height,
    position: 'relative',
    overflow: 'hidden',
    background: 'transparent',
    borderRadius: '8px',
    ...style,
  }), [size.width, size.height, style]);

  // Preview content style
  const previewStyle: React.CSSProperties = useMemo(() => ({
    width: '100%',
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    overflow: 'hidden',
  }), []);

  const Renderer = module.renderer;

  // Determine if we should render (performance optimization)
  const shouldRender = isVisible || !isPreviewVisible(module.metadata.id);

  return (
    <div
      ref={containerRef}
      className={cn('overlay-preview', className)}
      style={containerStyle}
      data-overlay-id={module.metadata.id}
      data-overlay-category={module.metadata.category}
      data-overlay-name={module.metadata.name}
      data-preview-visible={isVisible}
    >
      <div style={previewStyle}>
        {shouldRender && (
          <Renderer {...rendererProps} />
        )}
        {!shouldRender && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '12px',
            padding: '16px',
            textAlign: 'center',
          }}>
            <span>Preview paused (offscreen)</span>
            <span style={{ fontSize: '10px', marginTop: '4px' }}>
              {module.metadata.name}
            </span>
          </div>
        )}
      </div>

      {/* Optional badge */}
      {showBadge && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <span className="text-[10px] font-mono text-white/50 bg-[#101018]/80 backdrop-blur-sm px-2 py-0.5 rounded">
            {module.metadata.id}
          </span>
          {enablePerformanceMonitoring && metrics.renderCount > 0 && (
            <span className="text-[9px] font-mono text-green/70 bg-green/10 border border-green/20 px-1.5 py-0.5 rounded">
              {metrics.averageRenderTime.toFixed(1)}ms avg
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const OverlayPreview = memo(OverlayPreviewInner);
OverlayPreview.displayName = 'OverlayPreview';

export default OverlayPreview;