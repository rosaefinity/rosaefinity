import React, { useMemo, memo } from 'react';
import { cn } from '../../lib/utils';
import type { OverlayInstance, AnyOverlayModule } from '../../overlays/types';
import { getLayoutStyle } from './styles/previewLayout';
import { getAppearanceStyle } from './styles/previewAppearance';
import { getTypographyStyle } from './styles/previewTypography';
import { getAnimationStyle, PREVIEW_KEYFRAMES } from './styles/previewAnimation';

interface PreviewCanvasProps {
  instance: OverlayInstance | undefined;
  module: AnyOverlayModule | undefined;
  className?: string;
}

function PreviewCanvasInner({
  instance,
  module: mod,
  className,
}: PreviewCanvasProps): React.ReactElement {
  const Renderer = mod?.renderer;

  const previewStyle = useMemo(() => {
    if (!instance) return {};
    const c = instance.config;
    return {
      ...getLayoutStyle(c),
      ...getAppearanceStyle(c),
      ...getTypographyStyle(c),
      ...getAnimationStyle(c),
    };
  }, [instance]);

  return (
    <div
      className={cn(
        'flex-1 flex items-center justify-center',
        'bg-[#0a0a0f] relative overflow-hidden',
        className,
      )}
    >
      {/* Keyframes for preview animations */}
      <style dangerouslySetInnerHTML={{ __html: PREVIEW_KEYFRAMES }} />

      {/* Checker/grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(45deg, #fff 25%, transparent 25%),
            linear-gradient(-45deg, #fff 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #fff 75%),
            linear-gradient(-45deg, transparent 75%, #fff 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        }}
      />

      {/* Safe area overlay */}
      <div className="absolute inset-8 border border-dashed border-white/[0.06] rounded-lg pointer-events-none" />

      {/* Overlay preview */}
      {instance && Renderer ? (
        <div className="absolute inset-0">
          <div style={previewStyle}>
            <Renderer
              config={instance.config}
              mode="preview"
            />
          </div>
        </div>
      ) : (
        /* Placeholder when no overlay selected */
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <span className="text-xs text-white/20 font-medium">Select an overlay to preview</span>
        </div>
      )}
    </div>
  );
}

export const PreviewCanvas = memo(PreviewCanvasInner);
PreviewCanvas.displayName = 'PreviewCanvas';
