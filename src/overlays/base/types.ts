// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Base Theme & Animation Types
// v3.1 Architecture Spec (Frozen)
//
// Shared type definitions used by base/constants,
// base/themes, base/animations, and base/BaseOverlay.
// ─────────────────────────────────────────────────────

// ─── Overlay Theme ───

export interface OverlayThemeColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  surface: string;
  overlay: string;
}

export interface OverlayThemeTypography {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
}

export interface OverlayThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface OverlayThemeRadius {
  sm: number;
  md: number;
  lg: number;
  full: number;
}

export interface OverlayThemeShadow {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface OverlayThemeAnimation {
  fast: number;
  normal: number;
  slow: number;
  easing: string;
}

export interface OverlayTheme {
  colors: OverlayThemeColors;
  typography: OverlayThemeTypography;
  spacing: OverlayThemeSpacing;
  radius: OverlayThemeRadius;
  shadow: OverlayThemeShadow;
  animation: OverlayThemeAnimation;
}

// ─── Overlay Config Sub-Types ───

export interface OverlayColors {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string;
}

export interface OverlayBorder {
  width: number;
  color: string;
  radius: number;
}

export interface OverlayShadow {
  enabled: boolean;
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface OverlaySpacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ─── Animation Types ───

export interface AnimationKeyframes {
  initial: Record<string, unknown>;
  animate: Record<string, unknown>;
  transition: {
    duration: number;
    ease: string | number[];
    repeat?: number;
  };
}

export interface AnimationPreset {
  id: string;
  name: string;
  entry: AnimationKeyframes;
  exit: AnimationKeyframes;
  loop?: AnimationKeyframes;
  event?: AnimationKeyframes;
}

export interface OverlayAnimationConfig {
  entry: AnimationPreset;
  exit: AnimationPreset;
  loop?: AnimationPreset;
  event?: AnimationPreset;
}
