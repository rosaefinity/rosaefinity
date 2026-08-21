// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Animation Engine
// v3.1 Architecture Spec (Frozen)
// ─────────────────────────────────────────────────────

import type { AnimationKeyframes, AnimationPreset, OverlayAnimationConfig } from './types';

// ─── Animation Presets Library ───

const ENTRY_FADE: AnimationKeyframes = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

const EXIT_FADE: AnimationKeyframes = {
  initial: { opacity: 1 },
  animate: { opacity: 0 },
  transition: { duration: 0.3, ease: 'easeIn' },
};

const ENTRY_SLIDE_LEFT: AnimationKeyframes = {
  initial: { x: -50, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
};

const EXIT_SLIDE_LEFT: AnimationKeyframes = {
  initial: { x: 0, opacity: 1 },
  animate: { x: -50, opacity: 0 },
  transition: { duration: 0.3, ease: 'easeIn' },
};

const ENTRY_SLIDE_RIGHT: AnimationKeyframes = {
  initial: { x: 50, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
};

const EXIT_SLIDE_RIGHT: AnimationKeyframes = {
  initial: { x: 0, opacity: 1 },
  animate: { x: 50, opacity: 0 },
  transition: { duration: 0.3, ease: 'easeIn' },
};

const ENTRY_SLIDE_UP: AnimationKeyframes = {
  initial: { y: 50, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
};

const EXIT_SLIDE_UP: AnimationKeyframes = {
  initial: { y: 0, opacity: 1 },
  animate: { y: -50, opacity: 0 },
  transition: { duration: 0.3, ease: 'easeIn' },
};

const ENTRY_SLIDE_DOWN: AnimationKeyframes = {
  initial: { y: -50, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] },
};

const EXIT_SLIDE_DOWN: AnimationKeyframes = {
  initial: { y: 0, opacity: 1 },
  animate: { y: 50, opacity: 0 },
  transition: { duration: 0.3, ease: 'easeIn' },
};

const ENTRY_SCALE: AnimationKeyframes = {
  initial: { scale: 0.5, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

const EXIT_SCALE: AnimationKeyframes = {
  initial: { scale: 1, opacity: 1 },
  animate: { scale: 0.5, opacity: 0 },
  transition: { duration: 0.2, ease: 'easeIn' },
};

const ENTRY_BOUNCE: AnimationKeyframes = {
  initial: { scale: 0.3, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
};

const EXIT_BOUNCE: AnimationKeyframes = {
  initial: { scale: 1, opacity: 1 },
  animate: { scale: 0.3, opacity: 0 },
  transition: { duration: 0.3, ease: 'easeIn' },
};

const LOOP_PULSE: AnimationKeyframes = {
  initial: { scale: 1 },
  animate: { scale: [1, 1.05, 1] },
  transition: { duration: 2, ease: 'easeInOut', repeat: Infinity },
};

const LOOP_FLOAT: AnimationKeyframes = {
  initial: { y: 0 },
  animate: { y: [0, -5, 0] },
  transition: { duration: 3, ease: 'easeInOut', repeat: Infinity },
};

const LOOP_ROTATE: AnimationKeyframes = {
  initial: { rotate: 0 },
  animate: { rotate: 360 },
  transition: { duration: 10, ease: 'linear', repeat: Infinity },
};

const EVENT_SHAKE: AnimationKeyframes = {
  initial: { x: 0 },
  animate: { x: [0, -5, 5, -5, 5, 0] },
  transition: { duration: 0.4, ease: 'easeInOut' },
};

const EVENT_GLOW: AnimationKeyframes = {
  initial: { filter: 'drop-shadow(0 0 0px transparent)' },
  animate: { filter: 'drop-shadow(0 0 12px var(--overlay-primary, #e0306a))' },
  transition: { duration: 0.5, ease: 'easeInOut' },
};

// ─── Preset Registry ───

export const ANIMATION_PRESETS: Record<string, AnimationPreset> = {
  'fade': {
    id: 'fade', name: 'Fade',
    entry: ENTRY_FADE, exit: EXIT_FADE,
  },
  'slide-left': {
    id: 'slide-left', name: 'Slide Left',
    entry: ENTRY_SLIDE_LEFT, exit: EXIT_SLIDE_LEFT,
  },
  'slide-right': {
    id: 'slide-right', name: 'Slide Right',
    entry: ENTRY_SLIDE_RIGHT, exit: EXIT_SLIDE_RIGHT,
  },
  'slide-up': {
    id: 'slide-up', name: 'Slide Up',
    entry: ENTRY_SLIDE_UP, exit: EXIT_SLIDE_UP,
  },
  'slide-down': {
    id: 'slide-down', name: 'Slide Down',
    entry: ENTRY_SLIDE_DOWN, exit: EXIT_SLIDE_DOWN,
  },
  'scale': {
    id: 'scale', name: 'Scale',
    entry: ENTRY_SCALE, exit: EXIT_SCALE,
  },
  'bounce': {
    id: 'bounce', name: 'Bounce',
    entry: ENTRY_BOUNCE, exit: EXIT_BOUNCE,
  },
  'pulse-loop': {
    id: 'pulse-loop', name: 'Pulse',
    entry: ENTRY_FADE, exit: EXIT_FADE,
    loop: LOOP_PULSE,
  },
  'float-loop': {
    id: 'float-loop', name: 'Float',
    entry: ENTRY_FADE, exit: EXIT_FADE,
    loop: LOOP_FLOAT,
  },
  'rotate-loop': {
    id: 'rotate-loop', name: 'Rotate',
    entry: ENTRY_FADE, exit: EXIT_FADE,
    loop: LOOP_ROTATE,
  },
  'shake-event': {
    id: 'shake-event', name: 'Shake',
    entry: ENTRY_FADE, exit: EXIT_FADE,
    event: EVENT_SHAKE,
  },
  'glow-event': {
    id: 'glow-event', name: 'Glow',
    entry: ENTRY_FADE, exit: EXIT_FADE,
    event: EVENT_GLOW,
  },
};

// ─── No-op animations ───

const NOOP_KEYFRAMES: AnimationKeyframes = {
  initial: {},
  animate: {},
  transition: { duration: 0, ease: 'linear' },
};

// ─── Animation Engine ───

export interface AnimationEngine {
  getPreset(id: string): AnimationPreset | undefined;
  getPresets(): AnimationPreset[];
  getPresetsByCategory(category: 'entry' | 'exit' | 'loop' | 'event'): AnimationPreset[];
  resolveKeyframes(preset: AnimationKeyframes, speed: number): AnimationKeyframes;
  resolvePreset(presetId: string, speed: number): { entry: AnimationKeyframes; exit: AnimationKeyframes; loop?: AnimationKeyframes; event?: AnimationKeyframes };
}

function resolveSpeed(transition: AnimationKeyframes['transition'], speed: number): AnimationKeyframes['transition'] {
  const safeSpeed = speed || 1;
  return {
    ...transition,
    duration: transition.duration / safeSpeed,
  };
}

export function createAnimationEngine(): AnimationEngine {
  return {
    getPreset(id: string): AnimationPreset | undefined {
      return ANIMATION_PRESETS[id];
    },

    getPresets(): AnimationPreset[] {
      return Object.values(ANIMATION_PRESETS);
    },

    getPresetsByCategory(category: 'entry' | 'exit' | 'loop' | 'event'): AnimationPreset[] {
      return Object.values(ANIMATION_PRESETS).filter(p => {
        if (category === 'entry') return true; // all have entry
        if (category === 'exit') return true; // all have exit
        if (category === 'loop') return p.loop !== undefined;
        if (category === 'event') return p.event !== undefined;
        return false;
      });
    },

    resolveKeyframes(keyframes: AnimationKeyframes, speed: number): AnimationKeyframes {
      if (speed === 1) return keyframes;
      return {
        initial: keyframes.initial,
        animate: keyframes.animate,
        transition: resolveSpeed(keyframes.transition, speed),
      };
    },

    resolvePreset(presetId: string, speed: number) {
      const preset = ANIMATION_PRESETS[presetId] ?? ANIMATION_PRESETS['fade'];
      return {
        entry: this.resolveKeyframes(preset.entry, speed),
        exit: this.resolveKeyframes(preset.exit, speed),
        loop: preset.loop ? this.resolveKeyframes(preset.loop, speed) : undefined,
        event: preset.event ? this.resolveKeyframes(preset.event, speed) : undefined,
      };
    },
  };
}

/** Singleton animation engine */
export const animationEngine = createAnimationEngine();

/**
 * Get animation keyframes for a transition type.
 * Falls back to fade if unknown.
 */
export function getTransitionKeyframes(
  transition: string,
  speed: number,
): { entry: AnimationKeyframes; exit: AnimationKeyframes } {
  const preset = ANIMATION_PRESETS[transition] ?? ANIMATION_PRESETS['fade'];
  return {
    entry: animationEngine.resolveKeyframes(preset.entry, speed),
    exit: animationEngine.resolveKeyframes(preset.exit, speed),
  };
}

/**
 * Get no-op keyframes (for 'none' transition).
 */
export function getNoopKeyframes(): { entry: AnimationKeyframes; exit: AnimationKeyframes } {
  return { entry: NOOP_KEYFRAMES, exit: NOOP_KEYFRAMES };
}

/**
 * Check if reduced motion is preferred.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
