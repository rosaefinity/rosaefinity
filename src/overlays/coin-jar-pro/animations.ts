// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Coin Jar Pro Animations
// ─────────────────────────────────────────────────────

import type { Particle, FallingGift, AccumulatedGift, RecentGift } from './types';

// Physics constants
const GRAVITY = 0.8;
const AIR_RESISTANCE = 0.99;
const BOUNCE_DAMPING = 0.4;
const SETTLE_THRESHOLD = 0.5;

/**
 * Generate random particle type
 */
export function getRandomParticleType(): Particle['type'] {
  const types: Particle['type'][] = ['coin', 'heart', 'gift', 'flower'];
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Generate gift type based on gift name/category
 */
export function getGiftParticleType(giftName: string): Particle['type'] {
  const lowerName = giftName.toLowerCase();
  if (lowerName.includes('heart') || lowerName.includes('love') || lowerName.includes('rose')) return 'heart';
  if (lowerName.includes('flower') || lowerName.includes('bloom') || lowerName.includes('bouquet')) return 'flower';
  if (lowerName.includes('diamond') || lowerName.includes('gem') || lowerName.includes('crystal')) return 'diamond';
  if (lowerName.includes('gift') || lowerName.includes('box') || lowerName.includes('present')) return 'gift';
  return 'coin';
}

/**
 * Generate initial position above the jar
 */
export function getInitialFallingPosition(jarWidth: number, _jarHeight: number): { x: number; y: number } {
  const centerX = jarWidth / 2;
  const spread = jarWidth * 0.35;
  return {
    x: centerX + (Math.random() - 0.5) * spread,
    y: -80, // Start above the jar
  };
}

/**
 * Generate target position inside the jar based on fill level
 */
export function getTargetAccumulationPosition(
  jarWidth: number,
  jarHeight: number,
  fillRatio: number,
  existingGifts: AccumulatedGift[]
): { x: number; y: number } {
  const centerX = jarWidth / 2;
  const innerLeft = jarWidth * 0.2;
  const innerRight = jarWidth * 0.8;
  const innerBottom = jarHeight * 0.9;
  const fillHeight = jarHeight * 0.7;
  const baseY = innerBottom - fillHeight * fillRatio;

  // Try to find a spot near existing gifts for natural stacking
  let targetX = centerX + (Math.random() - 0.5) * (jarWidth * 0.25);
  let targetY = baseY + (Math.random() - 0.5) * (fillHeight * 0.15);

  // Avoid overlapping too much with existing gifts
  for (let attempt = 0; attempt < 10; attempt++) {
    let tooClose = false;
    for (const gift of existingGifts) {
      const dx = targetX - gift.x;
      const dy = targetY - gift.y;
      if (dx * dx + dy * dy < 400) { // 20px minimum distance
        tooClose = true;
        break;
      }
    }
    if (!tooClose) break;
    targetX = centerX + (Math.random() - 0.5) * (jarWidth * 0.25);
    targetY = baseY + (Math.random() - 0.5) * (fillHeight * 0.15);
  }

  return {
    x: Math.max(innerLeft, Math.min(innerRight, targetX)),
    y: Math.max(jarHeight * 0.3, Math.min(innerBottom, targetY)),
  };
}

/**
 * Create a new falling gift
 */
export function createFallingGift(
  jarWidth: number,
  jarHeight: number,
  fillRatio: number,
  giftData: RecentGift
): FallingGift {
  const initialPos = getInitialFallingPosition(jarWidth, jarHeight);
  const targetPos = getTargetAccumulationPosition(jarWidth, jarHeight, fillRatio, []);

  return {
    id: `falling-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: getGiftParticleType(giftData.giftName),
    x: initialPos.x,
    y: initialPos.y,
    targetX: targetPos.x,
    targetY: targetPos.y,
    scale: 0.7 + Math.random() * 0.3,
    rotation: (Math.random() - 0.5) * 40,
    velocity: { x: (Math.random() - 0.5) * 2, y: 0 },
    phase: 'spawn',
    giftData,
    startTime: Date.now(),
  };
}

/**
 * Create accumulated gift from settled falling gift
 */
export function createAccumulatedGift(
  fallingGift: FallingGift,
  jarWidth: number,
  jarHeight: number,
  fillRatio: number,
  existingGifts: AccumulatedGift[]
): AccumulatedGift {
  const targetPos = getTargetAccumulationPosition(jarWidth, jarHeight, fillRatio, existingGifts);

  return {
    id: `accumulated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: fallingGift.type,
    x: fallingGift.x,
    y: fallingGift.y,
    targetX: targetPos.x,
    targetY: targetPos.y,
    scale: fallingGift.scale * 0.9,
    rotation: fallingGift.rotation,
    opacity: 1,
    giftData: fallingGift.giftData,
    timestamp: Date.now(),
    settled: false,
  };
}

/**
 * Update falling gift physics
 */
export function updateFallingGiftPhysics(
  gift: FallingGift,
  jarWidth: number,
  jarHeight: number,
  fillRatio: number,
  deltaTime: number
): FallingGift {
  const innerLeft = jarWidth * 0.18;
  const innerRight = jarWidth * 0.82;
  const innerBottom = jarHeight * 0.88;
  const fillHeight = jarHeight * 0.7;
  const baseY = innerBottom - fillHeight * fillRatio;

  let { x, y, velocity, rotation, phase } = gift;
  const dt = deltaTime / 16.67; // Normalize to 60fps

  if (phase === 'spawn') {
    phase = 'fall';
  }

  if (phase === 'fall' || phase === 'enter') {
    // Apply gravity
    velocity.y += GRAVITY * dt;
    velocity.x *= AIR_RESISTANCE;

    // Update position
    x += velocity.x * dt;
    y += velocity.y * dt;
    rotation += velocity.x * 0.05 * dt;

    // Check collision with jar walls
    if (x < innerLeft && velocity.x < 0) {
      x = innerLeft;
      velocity.x *= -BOUNCE_DAMPING;
    } else if (x > innerRight && velocity.x > 0) {
      x = innerRight;
      velocity.x *= -BOUNCE_DAMPING;
    }

    // Check collision with fill level / bottom
    if (y >= baseY && velocity.y > 0) {
      if (phase === 'fall') {
        phase = 'enter';
      }

      if (Math.abs(velocity.y) < SETTLE_THRESHOLD && Math.abs(velocity.x) < SETTLE_THRESHOLD) {
        phase = 'settle';
        y = baseY;
        velocity.x = 0;
        velocity.y = 0;
      } else {
        // Bounce
        y = baseY;
        velocity.y *= -BOUNCE_DAMPING;
        velocity.x *= 0.8;
        phase = 'bounce';
      }
    }

    // Transition from bounce to settle
    if (phase === 'bounce' && Math.abs(velocity.y) < SETTLE_THRESHOLD && Math.abs(velocity.x) < SETTLE_THRESHOLD) {
      phase = 'settle';
      y = baseY;
      velocity.x = 0;
      velocity.y = 0;
    }
  }

  return {
    ...gift,
    x,
    y,
    velocity,
    rotation,
    phase,
  };
}

/**
 * Update accumulated gift settling animation
 */
export function updateAccumulatedGiftSettling(
  gift: AccumulatedGift,
  deltaTime: number
): AccumulatedGift {
  if (gift.settled) return gift;

  const dt = deltaTime / 16.67;
  const speed = 8 * dt;

  const dx = gift.targetX - gift.x;
  const dy = gift.targetY - gift.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) {
    return { ...gift, x: gift.targetX, y: gift.targetY, settled: true };
  }

  return {
    ...gift,
    x: gift.x + dx * speed,
    y: gift.y + dy * speed,
    settled: false,
  };
}

/**
 * Animation keyframes for different gift animation styles
 */
export function getGiftAnimationKeyframes(
  animation: 'drop' | 'float' | 'bounce' | 'slide',
  duration: number
): Record<string, unknown> {
  switch (animation) {
    case 'drop':
      return {
        initial: { y: -50, opacity: 0, rotate: 0, scale: 0.5 },
        animate: { y: 0, opacity: 1, rotate: 0, scale: 1 },
        transition: { duration: duration / 1000, ease: 'easeOut' },
      };
    case 'float':
      return {
        initial: { y: -50, opacity: 0, rotate: -15, scale: 0.5 },
        animate: { y: 0, opacity: 1, rotate: 15, scale: 1 },
        transition: { duration: duration / 1000, ease: 'easeInOut' },
      };
    case 'bounce':
      return {
        initial: { y: -50, opacity: 0, scale: 0.3 },
        animate: { y: [0, -10, 0], opacity: 1, scale: [1, 1.1, 1] },
        transition: { duration: duration / 1000, ease: 'easeOut' },
      };
    case 'slide':
      return {
        initial: { x: -100, y: -20, opacity: 0, rotate: -30, scale: 0.5 },
        animate: { x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 },
        transition: { duration: duration / 1000, ease: 'easeOut' },
      };
    default:
      return {
        initial: { y: -50, opacity: 0, scale: 0.5 },
        animate: { y: 0, opacity: 1, scale: 1 },
        transition: { duration: duration / 1000, ease: 'easeOut' },
      };
  }
}

/**
 * Notification animation keyframes
 */
export const notificationKeyframes = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.95 },
  transition: { duration: 0.3, ease: 'easeOut' },
};

/**
 * Fill level animation keyframes
 */
export const fillLevelKeyframes = {
  initial: { scaleY: 0, opacity: 0.8 },
  animate: { scaleY: 1, opacity: 1 },
  transition: { duration: 0.5, ease: 'easeOut' },
};

/**
 * Coin counter animation keyframes
 */
export const coinCounterKeyframes = {
  initial: { opacity: 0, y: 10, scale: 0.8 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.8 },
  transition: { duration: 0.4, ease: 'easeOut' },
};

/**
 * Get SVG path for particle icons
 */
export function getParticleIconPath(type: Particle['type'] | 'diamond'): string {
  switch (type) {
    case 'coin':
      return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z';
    case 'heart':
      return 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
    case 'gift':
      return 'M20 6h-8V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 0H4v2h8V6zm0 12H4v-2h8v2zm8-6H4V8h16v4z';
    case 'flower':
      return 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z';
    case 'diamond':
      return 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5';
    default:
      return '';
  }
}

/**
 * Get particle color based on type and theme
 */
export function getParticleColor(type: Particle['type'] | 'diamond', primaryColor: string, accentColor: string): string {
  switch (type) {
    case 'coin':
      return '#FFD700'; // Gold
    case 'heart':
      return '#FF6B9D'; // Pink
    case 'gift':
      return accentColor;
    case 'flower':
      return primaryColor;
    case 'diamond':
      return '#00FFFF'; // Cyan
    default:
      return primaryColor;
  }
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate fill ratio (0-1)
 */
export function calculateFillRatio(totalCoins: number, goalCoins: number, continueAfterGoal: boolean): number {
  if (goalCoins <= 0) return 0;
  const ratio = totalCoins / goalCoins;
  if (!continueAfterGoal) {
    return clamp(ratio, 0, 1);
  }
  return ratio; // Can exceed 1
}

/**
 * Format coin number with commas
 */
export function formatCoins(coins: number): string {
  return coins.toLocaleString();
}

/**
 * Maximum visual accumulated gifts
 */
export const MAX_ACCUMULATED_GIFTS = 60;

/**
 * Maximum falling gifts at once
 */
export const MAX_FALLING_GIFTS = 15;

/**
 * Create a new legacy particle (for backward compatibility with existing renderer)
 */
export function createParticle(
  jarWidth: number,
  jarHeight: number,
  fillRatio: number
): Particle {
  const centerX = jarWidth / 2;
  const spread = jarWidth * 0.3;
  const fillHeight = jarHeight * 0.7;
  const baseY = jarHeight - (jarHeight * 0.15);
  const targetY = baseY - fillHeight * fillRatio + (Math.random() - 0.5) * (fillHeight * 0.1);

  return {
    id: `particle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: getRandomParticleType(),
    x: centerX + (Math.random() - 0.5) * spread,
    y: -50,
    targetX: centerX + (Math.random() - 0.5) * (jarWidth * 0.25),
    targetY: Math.max(jarHeight * 0.2, targetY),
    scale: 0.5 + Math.random() * 0.5,
    rotation: (Math.random() - 0.5) * 30,
    opacity: 0,
    animationState: 'entering',
  } as Particle & { targetX: number; targetY: number };
}