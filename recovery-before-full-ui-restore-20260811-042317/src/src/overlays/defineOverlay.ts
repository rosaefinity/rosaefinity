import type { OverlayModule } from './types';

export function defineOverlay<TConfig extends Record<string, unknown>>(
  module: OverlayModule<TConfig>,
): OverlayModule<TConfig> {
  return module;
}
