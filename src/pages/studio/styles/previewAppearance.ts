import type { CSSProperties } from 'react';
import type { BaseOverlayConfig } from '../../../overlays/types';

export function getAppearanceStyle(config: BaseOverlayConfig): CSSProperties {
  return {
    backgroundColor: config.colors.background,
    borderRadius: config.border.radius,
    border: config.border.width > 0
      ? `${config.border.width}px solid ${config.border.color}`
      : 'none',
    boxShadow: config.shadow.enabled
      ? `${config.shadow.offsetX}px ${config.shadow.offsetY}px ${config.shadow.blur}px ${config.shadow.color}`
      : 'none',
    padding: `${config.padding.top}px ${config.padding.right}px ${config.padding.bottom}px ${config.padding.left}px`,
    margin: `${config.margin.top}px ${config.margin.right}px ${config.margin.bottom}px ${config.margin.left}px`,
  };
}
