// ─── Types ───
export type {
  SettingsFieldType,
  SettingsFieldOption,
  SettingsField,
  SettingsSection,
  SettingsSchema,
  OverlayModule,
  RendererProps,
  OverlayContext,
  OverlayEvent,
  OverlayEventSource,
  AnyOverlayModule,
  OverlayInstance,
} from './types';

// ─── Define Helper ───
export { defineOverlay } from './defineOverlay';

// ─── Registry ───
export {
  overlayRegistry,
  getOverlayModule,
  getOverlayModules,
  getOverlaysByCategory,
  hasOverlay,
  registryBuilder,
} from './registry';
