import type { CSSProperties } from 'react';
import type { BaseOverlayConfig } from '../../../overlays/types';

/**
 * Maps animation preset names to CSS keyframe names.
 * Keyframes must be defined via @keyframes in CSS or a <style> tag.
 */
const PRESET_TO_KEYFRAME: Record<string, string> = {
  none: '',
  fade: 'studio-fade',
  pop: 'studio-pop',
  'slide-up': 'studio-slide-up',
  'slide-down': 'studio-slide-down',
  'slide-left': 'studio-slide-left',
  'slide-right': 'studio-slide-right',
  bounce: 'studio-bounce',
  zoom: 'studio-zoom',
  pulse: 'studio-pulse',
};

export function getAnimationStyle(config: BaseOverlayConfig): CSSProperties {
  const preset = config.transition || 'none';
  const keyframe = PRESET_TO_KEYFRAME[preset] || '';

  if (!keyframe) {
    return {};
  }

  const parts = [
    keyframe,
    `${config.animationDuration ?? config.duration}s`,
    config.animationEasing || 'ease',
    `${config.animationDelay}s`,
  ];

  if (config.animationLoop) {
    parts.push('infinite');
  }

  return {
    animation: parts.join(' '),
  };
}

/**
 * CSS keyframes to inject into the document for preview animations.
 */
export const PREVIEW_KEYFRAMES = `
@keyframes studio-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes studio-pop {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes studio-slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes studio-slide-down {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes studio-slide-left {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes studio-slide-right {
  from { transform: translateX(-20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes studio-bounce {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.1); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes studio-zoom {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes studio-pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
`;
