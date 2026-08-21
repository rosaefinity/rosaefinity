import type { CSSProperties } from 'react';
import type { BaseOverlayConfig } from '../../../overlays/types';

export function getTypographyStyle(config: BaseOverlayConfig): CSSProperties {
  return {
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    fontWeight: config.fontWeight,
    letterSpacing: config.letterSpacing,
    lineHeight: config.lineHeight,
    textAlign: config.textAlign,
    textTransform: config.textTransform,
    color: config.colors.text,
    textShadow: config.textShadow.enabled
      ? `${config.textShadow.offsetX}px ${config.textShadow.offsetY}px ${config.textShadow.blur}px ${config.textShadow.color}`
      : 'none',
  };
}
