// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RosaeFinity Animation Engine â€” Animation Presets
// v3.1 Architecture Spec (Frozen)
//
// All presets are GPU-accelerated (transform + opacity only).
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import type { AnimationPresetEntry } from './AnimationTypes';

// â”€â”€â”€ Entry Animations â”€â”€â”€

const ENTRY_PRESETS: AnimationPresetEntry[] = [
  {
    id: 'entry-fade', name: 'Fade In', category: 'entry', description: 'Simple opacity fade', icon: 'ðŸ‘',
    definition: { keyframes: [{ properties: { opacity: 0 } }, { properties: { opacity: 1 } }], duration: 300, easing: 'ease-out', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-slide-left', name: 'Slide Left', category: 'entry', description: 'Slide in from left', icon: 'â†',
    definition: { keyframes: [{ properties: { transform: 'translateX(-50px)', opacity: 0 } }, { properties: { transform: 'translateX(0)', opacity: 1 } }], duration: 400, easing: 'spring', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-slide-right', name: 'Slide Right', category: 'entry', description: 'Slide in from right', icon: 'â†’',
    definition: { keyframes: [{ properties: { transform: 'translateX(50px)', opacity: 0 } }, { properties: { transform: 'translateX(0)', opacity: 1 } }], duration: 400, easing: 'spring', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-slide-up', name: 'Slide Up', category: 'entry', description: 'Slide in from bottom', icon: 'â†‘',
    definition: { keyframes: [{ properties: { transform: 'translateY(50px)', opacity: 0 } }, { properties: { transform: 'translateY(0)', opacity: 1 } }], duration: 400, easing: 'spring', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-slide-down', name: 'Slide Down', category: 'entry', description: 'Slide in from top', icon: 'â†“',
    definition: { keyframes: [{ properties: { transform: 'translateY(-50px)', opacity: 0 } }, { properties: { transform: 'translateY(0)', opacity: 1 } }], duration: 400, easing: 'spring', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-scale', name: 'Scale In', category: 'entry', description: 'Scale from zero', icon: 'âŠ•',
    definition: { keyframes: [{ properties: { transform: 'scale(0)', opacity: 0 } }, { properties: { transform: 'scale(1)', opacity: 1 } }], duration: 300, easing: 'bounce', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-zoom', name: 'Zoom In', category: 'entry', description: 'Zoom from center', icon: 'ðŸ”',
    definition: { keyframes: [{ properties: { transform: 'scale(0.5)', opacity: 0 } }, { properties: { transform: 'scale(1)', opacity: 1 } }], duration: 300, easing: 'ease-out', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-pop', name: 'Pop', category: 'entry', description: 'Pop in with overshoot', icon: 'ðŸ’¥',
    definition: { keyframes: [{ properties: { transform: 'scale(0)', opacity: 0 } }, { properties: { transform: 'scale(1.2)', opacity: 1 } }, { properties: { transform: 'scale(1)', opacity: 1 } }], duration: 400, easing: 'bounce', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-bounce', name: 'Bounce', category: 'entry', description: 'Bounce in', icon: 'âš½',
    definition: { keyframes: [{ properties: { transform: 'translateY(100px)', opacity: 0 } }, { properties: { transform: 'translateY(-20px)', opacity: 1 } }, { properties: { transform: 'translateY(0)', opacity: 1 } }], duration: 600, easing: 'bounce', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-elastic', name: 'Elastic', category: 'entry', description: 'Elastic overshoot', icon: 'ðŸª€',
    definition: { keyframes: [{ properties: { transform: 'scale(0)', opacity: 0 } }, { properties: { transform: 'scale(1.3)', opacity: 1 } }, { properties: { transform: 'scale(0.9)', opacity: 1 } }, { properties: { transform: 'scale(1.05)', opacity: 1 } }, { properties: { transform: 'scale(1)', opacity: 1 } }], duration: 700, easing: 'elastic', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-rotate', name: 'Rotate', category: 'entry', description: 'Rotate in', icon: 'ðŸ”„',
    definition: { keyframes: [{ properties: { transform: 'rotate(-180deg) scale(0)', opacity: 0 } }, { properties: { transform: 'rotate(0deg) scale(1)', opacity: 1 } }], duration: 500, easing: 'spring', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-flip', name: 'Flip', category: 'entry', description: '3D flip in', icon: 'ðŸª™',
    definition: { keyframes: [{ properties: { transform: 'perspective(800px) rotateY(90deg)', opacity: 0 } }, { properties: { transform: 'perspective(800px) rotateY(0deg)', opacity: 1 } }], duration: 500, easing: 'ease-out', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: true },
  },
  {
    id: 'entry-blur', name: 'Blur In', category: 'entry', description: 'Blur to sharp', icon: 'ðŸŒ«',
    definition: { keyframes: [{ properties: { filter: 'blur(10px)', opacity: 0 } }, { properties: { filter: 'blur(0px)', opacity: 1 } }], duration: 400, easing: 'ease-out', delay: 0, repeat: 0, direction: 'normal', fillMode: 'both', gpuAccelerated: false },
  },
];

// â”€â”€â”€ Exit Animations â”€â”€â”€

const EXIT_PRESETS: AnimationPresetEntry[] = [
  {
    id: 'exit-fade', name: 'Fade Out', category: 'exit', description: 'Simple opacity fade', icon: 'ðŸ‘',
    definition: { keyframes: [{ properties: { opacity: 1 } }, { properties: { opacity: 0 } }], duration: 300, easing: 'ease-in', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'exit-slide-left', name: 'Slide Left', category: 'exit', description: 'Slide out left', icon: 'â†',
    definition: { keyframes: [{ properties: { transform: 'translateX(0)', opacity: 1 } }, { properties: { transform: 'translateX(-50px)', opacity: 0 } }], duration: 300, easing: 'ease-in', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'exit-slide-right', name: 'Slide Right', category: 'exit', description: 'Slide out right', icon: 'â†’',
    definition: { keyframes: [{ properties: { transform: 'translateX(0)', opacity: 1 } }, { properties: { transform: 'translateX(50px)', opacity: 0 } }], duration: 300, easing: 'ease-in', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'exit-slide-up', name: 'Slide Up', category: 'exit', description: 'Slide out up', icon: 'â†‘',
    definition: { keyframes: [{ properties: { transform: 'translateY(0)', opacity: 1 } }, { properties: { transform: 'translateY(-50px)', opacity: 0 } }], duration: 300, easing: 'ease-in', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'exit-slide-down', name: 'Slide Down', category: 'exit', description: 'Slide out down', icon: 'â†“',
    definition: { keyframes: [{ properties: { transform: 'translateY(0)', opacity: 1 } }, { properties: { transform: 'translateY(50px)', opacity: 0 } }], duration: 300, easing: 'ease-in', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'exit-scale', name: 'Scale Out', category: 'exit', description: 'Scale to zero', icon: 'âŠ•',
    definition: { keyframes: [{ properties: { transform: 'scale(1)', opacity: 1 } }, { properties: { transform: 'scale(0)', opacity: 0 } }], duration: 300, easing: 'ease-in', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'exit-zoom', name: 'Zoom Out', category: 'exit', description: 'Zoom out', icon: 'ðŸ”',
    definition: { keyframes: [{ properties: { transform: 'scale(1)', opacity: 1 } }, { properties: { transform: 'scale(2)', opacity: 0 } }], duration: 400, easing: 'ease-in', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'exit-rotate', name: 'Rotate Out', category: 'exit', description: 'Rotate out', icon: 'ðŸ”„',
    definition: { keyframes: [{ properties: { transform: 'rotate(0deg) scale(1)', opacity: 1 } }, { properties: { transform: 'rotate(180deg) scale(0)', opacity: 0 } }], duration: 400, easing: 'ease-in', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'exit-flip', name: 'Flip Out', category: 'exit', description: '3D flip out', icon: 'ðŸª™',
    definition: { keyframes: [{ properties: { transform: 'perspective(800px) rotateY(0deg)', opacity: 1 } }, { properties: { transform: 'perspective(800px) rotateY(90deg)', opacity: 0 } }], duration: 400, easing: 'ease-in', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'exit-blur', name: 'Blur Out', category: 'exit', description: 'Blur to vanish', icon: 'ðŸŒ«',
    definition: { keyframes: [{ properties: { filter: 'blur(0px)', opacity: 1 } }, { properties: { filter: 'blur(10px)', opacity: 0 } }], duration: 300, easing: 'ease-in', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: false },
  },
];

// â”€â”€â”€ Loop Animations â”€â”€â”€

const LOOP_PRESETS: AnimationPresetEntry[] = [
  {
    id: 'loop-pulse', name: 'Pulse', category: 'loop', description: 'Gentle pulse', icon: 'ðŸ’“',
    definition: { keyframes: [{ properties: { transform: 'scale(1)' } }, { properties: { transform: 'scale(1.05)' } }, { properties: { transform: 'scale(1)' } }], duration: 2000, easing: 'ease-in-out', delay: 0, repeat: -1, direction: 'normal', fillMode: 'none', gpuAccelerated: true },
  },
  {
    id: 'loop-float', name: 'Float', category: 'loop', description: 'Gentle floating', icon: 'ðŸŽˆ',
    definition: { keyframes: [{ properties: { transform: 'translateY(0)' } }, { properties: { transform: 'translateY(-8px)' } }, { properties: { transform: 'translateY(0)' } }], duration: 3000, easing: 'ease-in-out', delay: 0, repeat: -1, direction: 'normal', fillMode: 'none', gpuAccelerated: true },
  },
  {
    id: 'loop-heartbeat', name: 'Heartbeat', category: 'loop', description: 'Heartbeat pulse', icon: 'â¤ï¸',
    definition: { keyframes: [{ properties: { transform: 'scale(1)' } }, { properties: { transform: 'scale(1.15)' } }, { properties: { transform: 'scale(1)' } }, { properties: { transform: 'scale(1.1)' } }, { properties: { transform: 'scale(1)' } }], duration: 1500, easing: 'ease-in-out', delay: 0, repeat: -1, direction: 'normal', fillMode: 'none', gpuAccelerated: true },
  },
  {
    id: 'loop-swing', name: 'Swing', category: 'loop', description: 'Pendulum swing', icon: 'ðŸª',
    definition: { keyframes: [{ properties: { transform: 'rotate(0deg)' } }, { properties: { transform: 'rotate(5deg)' } }, { properties: { transform: 'rotate(0deg)' } }, { properties: { transform: 'rotate(-5deg)' } }, { properties: { transform: 'rotate(0deg)' } }], duration: 2000, easing: 'ease-in-out', delay: 0, repeat: -1, direction: 'normal', fillMode: 'none', gpuAccelerated: true },
  },
  {
    id: 'loop-shake', name: 'Shake', category: 'loop', description: 'Horizontal shake', icon: 'ðŸ«¨',
    definition: { keyframes: [{ properties: { transform: 'translateX(0)' } }, { properties: { transform: 'translateX(-3px)' } }, { properties: { transform: 'translateX(3px)' } }, { properties: { transform: 'translateX(-3px)' } }, { properties: { transform: 'translateX(0)' } }], duration: 500, easing: 'linear', delay: 0, repeat: -1, direction: 'normal', fillMode: 'none', gpuAccelerated: true },
  },
  {
    id: 'loop-glow', name: 'Glow', category: 'loop', description: 'Glowing pulse', icon: 'âœ¨',
    definition: { keyframes: [{ properties: { filter: 'drop-shadow(0 0 0px transparent)' } }, { properties: { filter: 'drop-shadow(0 0 12px currentColor)' } }, { properties: { filter: 'drop-shadow(0 0 0px transparent)' } }], duration: 2000, easing: 'ease-in-out', delay: 0, repeat: -1, direction: 'normal', fillMode: 'none', gpuAccelerated: false },
  },
  {
    id: 'loop-breathing', name: 'Breathing', category: 'loop', description: 'Slow breathing', icon: 'ðŸ«',
    definition: { keyframes: [{ properties: { transform: 'scale(1)', opacity: 0.8 } }, { properties: { transform: 'scale(1.03)', opacity: 1 } }, { properties: { transform: 'scale(1)', opacity: 0.8 } }], duration: 4000, easing: 'ease-in-out', delay: 0, repeat: -1, direction: 'normal', fillMode: 'none', gpuAccelerated: true },
  },
  {
    id: 'loop-wiggle', name: 'Wiggle', category: 'loop', description: 'Quick wiggle', icon: 'ðŸª±',
    definition: { keyframes: [{ properties: { transform: 'rotate(0deg)' } }, { properties: { transform: 'rotate(3deg)' } }, { properties: { transform: 'rotate(-3deg)' } }, { properties: { transform: 'rotate(3deg)' } }, { properties: { transform: 'rotate(-3deg)' } }, { properties: { transform: 'rotate(0deg)' } }], duration: 400, easing: 'linear', delay: 0, repeat: -1, direction: 'normal', fillMode: 'none', gpuAccelerated: true },
  },
  {
    id: 'loop-spin', name: 'Spin', category: 'loop', description: 'Continuous rotation', icon: 'ðŸ”„',
    definition: { keyframes: [{ properties: { transform: 'rotate(0deg)' } }, { properties: { transform: 'rotate(360deg)' } }], duration: 3000, easing: 'linear', delay: 0, repeat: -1, direction: 'normal', fillMode: 'none', gpuAccelerated: true },
  },
  {
    id: 'loop-typing-cursor', name: 'Typing Cursor', category: 'loop', description: 'Blinking cursor', icon: 'âœï¸',
    definition: { keyframes: [{ properties: { opacity: '1' } }, { properties: { opacity: '0' } }], duration: 800, easing: 'linear', delay: 0, repeat: -1, direction: 'normal', fillMode: 'none', gpuAccelerated: true },
  },
];

// â”€â”€â”€ Event Animations â”€â”€â”€

const EVENT_PRESETS: AnimationPresetEntry[] = [
  {
    id: 'event-gift-explosion', name: 'Gift Explosion', category: 'event', description: 'Gift burst effect', icon: 'ðŸŽ',
    definition: { keyframes: [{ properties: { transform: 'scale(0) rotate(0deg)', opacity: 0 } }, { properties: { transform: 'scale(1.5) rotate(10deg)', opacity: 1 } }, { properties: { transform: 'scale(1) rotate(0deg)', opacity: 1 } }], duration: 500, easing: 'bounce', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'event-like-burst', name: 'Like Burst', category: 'event', description: 'Heart burst', icon: 'â¤ï¸',
    definition: { keyframes: [{ properties: { transform: 'scale(0.5)', opacity: 0 } }, { properties: { transform: 'scale(1.3)', opacity: 1 } }, { properties: { transform: 'scale(1)', opacity: 1 } }], duration: 400, easing: 'bounce', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'event-follow-flash', name: 'Follow Flash', category: 'event', description: 'Follow flash', icon: 'ðŸ‘¤',
    definition: { keyframes: [{ properties: { transform: 'translateY(20px)', opacity: 0 } }, { properties: { transform: 'translateY(0)', opacity: 1 } }, { properties: { transform: 'translateY(0)', opacity: 1 } }, { properties: { transform: 'translateY(-20px)', opacity: 0 } }], duration: 2000, easing: 'ease-out', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'event-share-ripple', name: 'Share Ripple', category: 'event', description: 'Ripple effect', icon: 'ðŸ”—',
    definition: { keyframes: [{ properties: { transform: 'scale(0.8)', opacity: 0 } }, { properties: { transform: 'scale(1.1)', opacity: 1 } }, { properties: { transform: 'scale(1)', opacity: 1 } }], duration: 600, easing: 'elastic', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'event-comment-pop', name: 'Comment Pop', category: 'event', description: 'Chat message pop', icon: 'ðŸ’¬',
    definition: { keyframes: [{ properties: { transform: 'scale(0) translateY(10px)', opacity: 0 } }, { properties: { transform: 'scale(1.1) translateY(-2px)', opacity: 1 } }, { properties: { transform: 'scale(1) translateY(0)', opacity: 1 } }], duration: 350, easing: 'bounce', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'event-confetti', name: 'Confetti', category: 'event', description: 'Confetti burst', icon: 'ðŸŽ‰',
    definition: { keyframes: [{ properties: { transform: 'translateY(0) rotate(0deg) scale(1)', opacity: 1 } }, { properties: { transform: 'translateY(-100px) rotate(720deg) scale(0.5)', opacity: 0 } }], duration: 1500, easing: 'gravity', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'event-fireworks', name: 'Fireworks', category: 'event', description: 'Firework burst', icon: 'ðŸŽ†',
    definition: { keyframes: [{ properties: { transform: 'scale(0)', opacity: 0 } }, { properties: { transform: 'scale(2)', opacity: 1 } }, { properties: { transform: 'scale(0.8)', opacity: 0.8 } }, { properties: { transform: 'scale(3)', opacity: 0 } }], duration: 1000, easing: 'expo', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'event-coin-rain', name: 'Coin Rain', category: 'event', description: 'Coin drop effect', icon: 'ðŸª™',
    definition: { keyframes: [{ properties: { transform: 'translateY(-50px) rotate(0deg)', opacity: 0 } }, { properties: { transform: 'translateY(0) rotate(360deg)', opacity: 1 } }], duration: 800, easing: 'bounce', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'event-combo-pulse', name: 'Combo Pulse', category: 'event', description: 'Combo counter pulse', icon: 'ðŸ”¥',
    definition: { keyframes: [{ properties: { transform: 'scale(1)' } }, { properties: { transform: 'scale(1.3)' } }, { properties: { transform: 'scale(1)' } }], duration: 300, easing: 'bounce', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
  {
    id: 'event-leaderboard-flash', name: 'Leaderboard Flash', category: 'event', description: 'Leaderboard rank flash', icon: 'ðŸ†',
    definition: { keyframes: [{ properties: { opacity: 0.5 } }, { properties: { opacity: 1 } }, { properties: { opacity: 0.5 } }, { properties: { opacity: 1 } }], duration: 600, easing: 'linear', delay: 0, repeat: 0, direction: 'normal', fillMode: 'forwards', gpuAccelerated: true },
  },
];

// â”€â”€â”€ All Presets â”€â”€â”€

export const ALL_ANIMATION_PRESETS: readonly AnimationPresetEntry[] = [
  ...ENTRY_PRESETS,
  ...EXIT_PRESETS,
  ...LOOP_PRESETS,
  ...EVENT_PRESETS,
];

// â”€â”€â”€ Lookup Helpers â”€â”€â”€

export function getAnimationPreset(id: string): AnimationPresetEntry | undefined {
  return ALL_ANIMATION_PRESETS.find(p => p.id === id);
}

export function getAnimationPresetsByCategory(category: AnimationCategory): readonly AnimationPresetEntry[] {
  return ALL_ANIMATION_PRESETS.filter(p => p.category === category);
}

export function searchAnimationPresets(query: string): readonly AnimationPresetEntry[] {
  const q = query.toLowerCase();
  return ALL_ANIMATION_PRESETS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q)
  );
}
