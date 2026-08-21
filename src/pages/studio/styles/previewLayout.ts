import type { CSSProperties } from 'react';
import type { BaseOverlayConfig } from '../../../overlays/types';

export function getLayoutStyle(config: BaseOverlayConfig): CSSProperties {
  return {
    position: 'absolute',
    left: config.position.x,
    top: config.position.y,
    width: config.size.width,
    height: config.size.height,
    transform: `scale(${config.scale}) rotate(${config.rotation}deg)`,
    opacity: config.opacity,
    transformOrigin: 'top left',
  };
}
