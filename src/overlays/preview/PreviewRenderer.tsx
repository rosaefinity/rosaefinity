// ─────────────────────────────────────────────────────
// RosaeFinity Overlay Preview — Preview Renderer
// Renders the actual overlay renderer with mock events
// ─────────────────────────────────────────────────────

import React, { useMemo, useEffect, useRef, memo } from 'react';
import type { AnyOverlayModule, RendererProps, OverlayEventSource } from '../types';
import { usePreviewContext } from './PreviewProvider';
import { createOverlayConfig } from '../createConfig';

// ═══════════════════════════════════════════════════════
// PREVIEW RENDERER COMPONENT
// ═══════════════════════════════════════════════════════

interface PreviewRendererProps {
  /** The overlay module to render */
  module: AnyOverlayModule;
  /** Optional custom config (defaults to module.defaultConfig) */
  config?: RendererProps['config'];
  /** Preview container size */
  size?: { width: number; height: number };
  /** Custom event source (uses mock if not provided) */
  events?: OverlayEventSource;
  /** Override the default mock event interval */
  mockEventIntervalMs?: number;
  /** Disable mock events entirely */
  disableMockEvents?: boolean;
  /** Class name for the preview container */
  className?: string;
  /** Style for the preview container */
  style?: React.CSSProperties;
}

/**
 * PreviewRenderer - Renders an overlay module with mock events for preview purposes.
 *
 * This component:
 * - Uses the actual overlay renderer from the module
 * - Applies the module's defaultConfig (or custom config)
 * - Provides mock events via the preview context
 * - Handles visibility tracking for performance optimization
 * - Isolates the preview in a contained environment
 */
export function PreviewRendererInner({
  module,
  config,
  size = { width: 480, height: 280 },
  events: customEvents,
  mockEventIntervalMs,
  disableMockEvents = false,
  className = '',
  style,
}: PreviewRendererProps): React.ReactElement {
  const { getEventSource, registerPreview, isPreviewVisible } = usePreviewContext();

  // Use custom events or get mock events from context
  const mockEvents = useMemo(() => {
    if (disableMockEvents || customEvents) return customEvents;
    return getEventSource(module.metadata.id, mockEventIntervalMs);
  }, [module.metadata.id, customEvents, disableMockEvents, getEventSource, mockEventIntervalMs]);

  // Track visibility for performance optimization
  const containerRef = useRef<HTMLDivElement>(null);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isVisible = entry.isIntersecting;
          registerPreview(module.metadata.id, isVisible);
          prevVisibleRef.current = isVisible;
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [module.metadata.id, registerPreview]);

  // Prepare renderer props
  const rendererProps = useMemo<RendererProps>(() => ({
    config: config ?? createOverlayConfig(module),
    mode: 'preview' as const,
    events: mockEvents,
    size,
  }), [config, module.defaultConfig, mockEvents, size]);

  const Renderer = module.renderer;

  // Calculate container styles
  const containerStyle: React.CSSProperties = useMemo(() => ({
    width: size.width,
    height: size.height,
    position: 'relative',
    overflow: 'hidden',
    background: 'transparent',
    ...style,
  }), [size.width, size.height, style]);

  return (
    <div
      ref={containerRef}
      className={`preview-renderer ${className}`}
      style={containerStyle}
      data-overlay-id={module.metadata.id}
      data-overlay-category={module.metadata.category}
    >
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Renderer {...rendererProps} />
      </div>
    </div>
  );
}

export const PreviewRenderer = memo(PreviewRendererInner);

export default PreviewRenderer;