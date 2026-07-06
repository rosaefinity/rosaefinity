// =============================================
// Overlay Engine — Data Model Types
// =============================================

import type { ScreenId } from "./index";

// ===== Overlay =====
export interface Overlay {
  id: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  activeSceneId: string;
  scenes: Scene[];
  theme: OverlayTheme;
  settings: OverlaySettings;
}

// ===== Scene =====
export interface Scene {
  id: string;
  name: string;
  widgets: Widget[];
  groups: WidgetGroup[];
  visible: boolean;
  order: number;
  transition: TransitionConfig;
  background: string;
}

// ===== Widget =====
export interface Widget {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  groupId?: string;
  props: Record<string, unknown>;
  animations: AnimationConfig[];
}

// ===== Widget Group =====
export interface WidgetGroup {
  id: string;
  name: string;
  widgetIds: string[];
  locked: boolean;
}

// ===== Overlay Theme =====
export interface OverlayTheme {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  transparency: number;
  scale: number;
  borderRadius: number;
  animationSpeed: "slow" | "normal" | "fast";
  fontFamily: string;
  fontSize: number;
}

// ===== Overlay Settings =====
// Reserved fields for future subsystems (renderer, editor, cloud sync)
export interface OverlaySettings {
  // Screen routing
  assignedScreens: ScreenId[];
  // Renderer settings (future)
  rendererWidth: number;
  rendererHeight: number;
  // Editor settings (future, NOT persisted — placeholder for schema completeness)
  defaultGridSize: number;
  snapToGrid: boolean;
  showGuides: boolean;
}

// ===== Animation Config =====
export interface AnimationConfig {
  id: string;
  trigger: "on-enter" | "on-exit" | "on-event" | "loop";
  type: "fade" | "slide" | "scale" | "bounce" | "spin" | "custom";
  duration: number;
  delay: number;
  easing: string;
  loop: boolean;
}

// ===== Widget-Specific Props =====

export interface TextWidgetProps {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right';
  color: string;
  opacity: number;
  backgroundColor: string;
  borderRadius: number;
  border: string;
  boxShadow: string;
}

export interface ImageWidgetProps {
  src: string;
  fit: 'cover' | 'contain' | 'fill' | 'none';
  opacity: number;
  backgroundColor: string;
  borderRadius: number;
  border: string;
  boxShadow: string;
}

export interface BrowserWidgetProps {
  url: string;
  opacity: number;
  backgroundColor: string;
  borderRadius: number;
  border: string;
  boxShadow: string;
}

export interface VideoWidgetProps {
  src: string;
  autoplay: boolean;
  loop: boolean;
  opacity: number;
  backgroundColor: string;
  borderRadius: number;
  border: string;
  boxShadow: string;
}

/** Default props for each widget type */
export const DEFAULT_TEXT_PROPS: TextWidgetProps = {
  text: 'Text',
  fontFamily: 'Inter, sans-serif',
  fontSize: 24,
  fontWeight: 'normal',
  textAlign: 'left',
  color: '#ffffff',
  opacity: 1,
  backgroundColor: 'transparent',
  borderRadius: 0,
  border: 'none',
  boxShadow: 'none',
};

export const DEFAULT_IMAGE_PROPS: ImageWidgetProps = {
  src: '',
  fit: 'cover',
  opacity: 1,
  backgroundColor: 'transparent',
  borderRadius: 0,
  border: 'none',
  boxShadow: 'none',
};

export const DEFAULT_BROWSER_PROPS: BrowserWidgetProps = {
  url: '',
  opacity: 1,
  backgroundColor: 'transparent',
  borderRadius: 0,
  border: 'none',
  boxShadow: 'none',
};

export const DEFAULT_VIDEO_PROPS: VideoWidgetProps = {
  src: '',
  autoplay: false,
  loop: false,
  opacity: 1,
  backgroundColor: 'transparent',
  borderRadius: 0,
  border: 'none',
  boxShadow: 'none',
};

/** Map widget type string to its props interface */
export interface WidgetPropsMap {
  text: TextWidgetProps;
  image: ImageWidgetProps;
  browser: BrowserWidgetProps;
  video: VideoWidgetProps;
  [key: string]: Record<string, unknown>;
}

/** Discriminated union of all known widget props */
export type KnownWidgetProps = TextWidgetProps | ImageWidgetProps | BrowserWidgetProps | VideoWidgetProps;

/** Get default props for a widget type */
export function getDefaultProps(widgetType: string): Record<string, unknown> {
  switch (widgetType) {
    case 'text': return { ...DEFAULT_TEXT_PROPS };
    case 'image': return { ...DEFAULT_IMAGE_PROPS };
    case 'browser': return { ...DEFAULT_BROWSER_PROPS };
    case 'video': return { ...DEFAULT_VIDEO_PROPS };
    default: return {};
  }
}

// ===== Scene Transition =====
export interface TransitionConfig {
  type: "none" | "fade" | "slide-left" | "slide-right" | "scale" | "dissolve";
  duration: number;
}

// ===== Overlay Defaults =====
export const DEFAULT_OVERLAY_THEME: OverlayTheme = {
  name: "Default",
  primaryColor: "#e0306a",
  secondaryColor: "#4e7bff",
  backgroundColor: "transparent",
  transparency: 1,
  scale: 1,
  borderRadius: 12,
  animationSpeed: "normal",
  fontFamily: "Inter, sans-serif",
  fontSize: 16,
};

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  assignedScreens: [],
  rendererWidth: 1920,
  rendererHeight: 1080,
  defaultGridSize: 10,
  snapToGrid: true,
  showGuides: true,
};

export const DEFAULT_TRANSITION: TransitionConfig = {
  type: "fade",
  duration: 300,
};
