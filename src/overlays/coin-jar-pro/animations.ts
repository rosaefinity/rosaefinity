// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Coin Jar Pro Animations
// ─────────────────────────────────────────────────────

import type { Particle, FallingGift, AccumulatedGift, RecentGift } from './types';
import { JAR_GEOMETRY } from './CoinJarProRenderer';

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
 * Generate initial position above the jar - aligned with jar neck opening
 */
export function getInitialFallingPosition(jarWidth: number, _jarHeight: number): { x: number; y: number } {
  const centerX = jarWidth / 2;
  // Use neck width for initial spread (gifts fall through the opening)
  const neckLeft = JAR_GEOMETRY.neck.left * (jarWidth / 200);
  const neckRight = JAR_GEOMETRY.neck.right * (jarWidth / 200);
  const neckCenterX = JAR_GEOMETRY.neck.centerX * (jarWidth / 200);
  const spread = (neckRight - neckLeft) * 0.8; // 80% of neck width
  return {
    x: neckCenterX + (Math.random() - 0.5) * spread,
    y: -80, // Start above the jar (in design space y=-80 is well above opening at y=15)
  };
}

/**
 * Generate target position inside the jar based on fill level.
 * Uses exact jar silhouette (quadratic bezier) for boundary calculation.
 * Deterministic staggered grid placement fills the full jar width at each height.
 */
export function getTargetAccumulationPosition(
  jarWidth: number,
  jarHeight: number,
  fillRatio: number,
  existingGifts: AccumulatedGift[]
): { x: number; y: number } {
  // Returns positions in DESIGN SPACE (0-200 x, 0-210 y)
  // Uses INNER clipping boundaries so gifts are never clipped by SVG clipPath

  const innerTop = 34;      // Inner clipping top (below neck/shoulder transition)
  const innerBottom = 192;  // Inner clipping bottom (above jar base)
  const centerX = 100;
  const GIFT_SIZE = 20;
  const HALF = GIFT_SIZE / 2;

  // ── Inner clipping boundary at any Y ──
  // Matches jarInner SVG path exactly — gifts placed within these bounds are guaranteed visible
  const LEFT_NECK = 80, RIGHT_NECK = 120;

  // Helper: evaluate quadratic bezier at parameter t
  function qb(t: number, p0: number, p1: number, p2: number): number {
    const u = 1 - t;
    return u * u * p0 + 2 * u * t * p1 + t * t * p2;
  }

  // Solve for t in quadratic bezier y-equation: at² + bt + c = y
  function solveT(a: number, b: number, c: number, y: number): number[] {
    const disc = b * b - 4 * a * (c - y);
    if (disc < 0) return [];
    const sq = Math.sqrt(disc);
    const t1 = (-b - sq) / (2 * a);
    const t2 = (-b + sq) / (2 * a);
    const ts: number[] = [];
    if (t1 >= 0 && t1 <= 1) ts.push(t1);
    if (t2 >= 0 && t2 <= 1) ts.push(t2);
    return ts;
  }

  function jarBounds(y: number): [number, number] {
    // Inner clipping neck: x=80 to x=120
    if (y <= 34) return [LEFT_NECK, RIGHT_NECK];

    // Inner clipping shoulders (y=34→60): P0=(80/120,34) P1=(30/170,34) P2=(30/170,60)
    if (y <= 60) {
      const ts = solveT(26, -52, 60, y);
      const lx = ts.length > 0 ? qb(ts[0], 80, 30, 30) : 30;
      const rx = ts.length > 0 ? qb(ts[0], 120, 170, 170) : 170;
      return [lx, rx];
    }

    // Inner clipping body: x=30 to x=170 (straight walls)
    if (y <= 170) return [30, 170];

    // Inner clipping bottom (y=170→192): curves inward
    const ts = solveT(22, -44, 192, y);
    const lx = ts.length > 0 ? qb(ts[0], 30, 30, 100) : 100;
    const rx = ts.length > 0 ? qb(ts[0], 170, 170, 100) : 100;
    return [lx, rx];
  }

  // ── Deterministic staggered grid placement ──
  const giftSize = 20;
  const rowStep = giftSize * 0.75;
  const colStep = giftSize * 0.8;
  const MIN_GAP = giftSize * 0.55; // Minimum center-to-center distance (allows ~30% overlap)

  // Find pile top
  let pileTopY = innerBottom;
  if (existingGifts.length > 0) {
    pileTopY = Math.min(...existingGifts.map(g => g.y));
  }

  // Scan rows from bottom to top
  for (let rowY = innerBottom - HALF; rowY >= innerTop + HALF; rowY -= rowStep) {
    const [leftAtRow, rightAtRow] = jarBounds(rowY);
    const usableWidth = rightAtRow - leftAtRow;
    if (usableWidth < giftSize) continue;

    // Valid center range: gift image must not extend beyond jar boundary
    const centerLeft = leftAtRow + HALF;
    const centerRight = rightAtRow - HALF;
    const centerWidth = centerRight - centerLeft;
    if (centerWidth < 1) continue;

    // Stagger alternating rows by half column
    const rowIdx = Math.round((innerBottom - rowY) / rowStep);
    const rowOffset = (rowIdx % 2) * (colStep * 0.5);

    // Number of positions that fit across the full jar width at this height
    const numPositions = Math.max(1, Math.floor(centerWidth / colStep) + 1);
    const gridWidth = (numPositions - 1) * colStep;

    // Center the grid within the valid center range
    const startX = centerLeft + (centerWidth - gridWidth) / 2;

    for (let i = 0; i < numPositions; i++) {
      const cx = startX + i * colStep + rowOffset;
      const cy = rowY; // No random jitter — deterministic grid

      // Verify boundary (gift image must stay inside jar)
      const [leftBound, rightBound] = jarBounds(cy);
      if (cx - HALF < leftBound || cx + HALF > rightBound) continue;
      if (cy + HALF > innerBottom || cy - HALF < innerTop) continue;

      // Overlap check — use TARGET position for settled/settling gifts
      // (falling gifts use current x/y; settling gifts use targetX/targetY)
      // This prevents multiple settling gifts from targeting the same pile position
      let tooCrowded = false;
      const minDistSq = MIN_GAP * MIN_GAP;
      for (const gift of existingGifts) {
        const gx = gift.targetX ?? gift.x;
        const gy = gift.targetY ?? gift.y;
        const dx = cx - gx;
        const dy = cy - gy;
        if (dx * dx + dy * dy < minDistSq) {
          tooCrowded = true;
          break;
        }
      }

      if (!tooCrowded) {
        // [COIN-JAR-ACCUMULATION] log each placed gift
        console.log('[COIN-JAR-ACCUMULATION]', JSON.stringify({
          giftIndex: existingGifts.length,
          targetX: Math.round(cx),
          targetY: Math.round(cy),
          availableLeft: Math.round(leftAtRow),
          availableRight: Math.round(rightAtRow),
          availableWidth: Math.round(usableWidth),
          row: rowIdx,
          rowCapacity: numPositions,
          colIndex: i,
        }));
        return { x: cx, y: cy };
      } else {
        console.log('[COIN-JAR-ACCUMULATION-REJECT]', JSON.stringify({
          giftIndex: existingGifts.length,
          candidateX: Math.round(cx),
          candidateY: Math.round(cy),
          reason: 'overlap',
        }));
      }
    }
  }

  // ── Full-jar fallback: scan upward from pile top to find ANY valid gap ──
  console.log('[COIN-JAR-FULL] NO_POSITION_AVAILABLE', JSON.stringify({
    accumulatedCount: existingGifts.length,
    pileTopY: Math.round(pileTopY),
    reason: 'main_grid_scan_exhausted',
  }));
  console.log('[COIN-JAR-FULL] SEARCH_START', JSON.stringify({
    accumulatedCount: existingGifts.length,
    pileTopY: Math.round(pileTopY),
    innerTop, innerBottom,
  }));

  const minDistSq = MIN_GAP * MIN_GAP;
  for (let fallbackRow = 1; fallbackRow <= 60; fallbackRow++) {
    const fallbackY = Math.max(innerTop + HALF, pileTopY - rowStep * fallbackRow);
    if (fallbackY < innerTop + HALF) break; // reached top of jar

    const [fbLeft, fbRight] = jarBounds(fallbackY);
    const fbCenterLeft = fbLeft + HALF;
    const fbCenterRight = fbRight - HALF;
    const fbCenterWidth = fbCenterRight - fbCenterLeft;
    if (fbCenterWidth < 1) continue;

    const numFit = Math.max(1, Math.floor(fbCenterWidth / colStep) + 1);
    const fbGridWidth = (numFit - 1) * colStep;
    const fbStartX = fbCenterLeft + (fbCenterWidth - fbGridWidth) / 2;
    const fbRowIdx = Math.round((innerBottom - fallbackY) / rowStep);
    const fbRowOffset = (fbRowIdx % 2) * (colStep * 0.5);

    for (let i = 0; i < numFit; i++) {
      const cx = fbStartX + i * colStep + fbRowOffset;
      // Verify boundary
      if (cx - HALF < fbLeft || cx + HALF > fbRight) continue;
      if (fallbackY + HALF > innerBottom || fallbackY - HALF < innerTop) continue;

      let tooCrowded = false;
      for (const gift of existingGifts) {
        const gx = gift.targetX ?? gift.x;
        const gy = gift.targetY ?? gift.y;
        const dx = cx - gx;
        const dy = fallbackY - gy;
        if (dx * dx + dy * dy < minDistSq) {
          tooCrowded = true;
          break;
        }
      }
      if (!tooCrowded) {
        console.log('[COIN-JAR-FULL] VALID_POSITION_FOUND', JSON.stringify({
          x: Math.round(cx), y: Math.round(fallbackY),
          fallbackRow, colIndex: i,
        }));
        return { x: cx, y: fallbackY };
      }
    }
  }

  // Absolute fallback: highest valid position, centered, verified against bounds
  const absFallbackY = Math.max(innerTop + HALF, Math.min(pileTopY - rowStep, innerBottom - HALF));
  const [absLeft, absRight] = jarBounds(absFallbackY);
  const clampedX = Math.max(absLeft + HALF, Math.min(centerX, absRight - HALF));
  console.log('[COIN-JAR-FULL] FALLBACK', JSON.stringify({
    x: Math.round(clampedX), y: Math.round(absFallbackY),
    reason: 'no_valid_position_found',
    jarBoundsLeft: absLeft, jarBoundsRight: absRight,
  }));
  return { x: clampedX, y: absFallbackY };
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
    velocity: { x: (Math.random() - 0.5) * 2, y: 1.0 },
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
  const gd = fallingGift.giftData;

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
    giftData: gd,
    giftImageUrl: gd?.giftImageUrl || '',
    giftName: gd?.giftName || 'Gift',
    timestamp: Date.now(),
    settled: false,
  };
}

/**
 * Update falling gift physics - uses JAR_GEOMETRY for precise collision boundaries
 */
export function updateFallingGiftPhysics(
  gift: FallingGift,
  jarWidth: number,
  jarHeight: number,
  fillRatio: number,
  deltaTime: number
): FallingGift {
  const scaleX = jarWidth / 200;
  const scaleY = jarHeight / 192; // Matches new jar design height

  // Use JAR_GEOMETRY for precise boundaries
  const neckLeft = JAR_GEOMETRY.neck.left * scaleX;
  const neckRight = JAR_GEOMETRY.neck.right * scaleX;
  const innerLeft = JAR_GEOMETRY.inner.left * scaleX;
  const innerRight = JAR_GEOMETRY.inner.right * scaleX;
  const innerTop = JAR_GEOMETRY.inner.top * scaleY;
  const innerBottom = JAR_GEOMETRY.inner.bottom * scaleY;
  const innerCenterX = JAR_GEOMETRY.inner.centerX * scaleX;

  // Fill height calculation
  const fillHeight = (innerBottom - innerTop) * 0.95;
  const baseY = innerBottom - fillHeight * fillRatio;

  let { x, y, velocity, rotation, phase } = gift;
  const dt = deltaTime / 16.67; // Normalize to 60fps

  if (phase === 'spawn') {
    phase = 'fall';
  }

  // Check bounce settle BEFORE physics update (before gravity increases velocity above threshold)
  if (phase === 'bounce' && Math.abs(velocity.y) < SETTLE_THRESHOLD && Math.abs(velocity.x) < SETTLE_THRESHOLD) {
    console.log('[COIN-JAR-DEBUG] PHASE_SETTLE_FROM_BOUNCE', {
      y: Math.round(y), vy: Math.round(velocity.y * 100) / 100,
      baseY: Math.round(baseY),
    });
    phase = 'settle';
    y = baseY;
    velocity.x = 0;
    velocity.y = 0;
    return { ...gift, x, y, velocity, rotation, phase };
  }

  if (phase === 'fall' || phase === 'enter' || phase === 'bounce') {
    // Apply gravity
    velocity.y += GRAVITY * dt;
    velocity.x *= AIR_RESISTANCE;

    // Update position
    x += velocity.x * dt;
    y += velocity.y * dt;
    rotation += velocity.x * 0.05 * dt;

    // Check collision with jar walls - curved boundaries based on Y position
    // At neck level: use neck bounds
    // At body level: use curved inner bounds
    const isInNeck = y < JAR_GEOMETRY.neck.bottom * scaleY;
    const wallLeft = isInNeck ? neckLeft : innerLeft;
    const wallRight = isInNeck ? neckRight : innerRight;

    // For body, calculate curved wall position based on Y
    if (!isInNeck) {
      const relativeY = Math.max(0, Math.min(1, (y - innerTop) / (innerBottom - innerTop)));
      const radiusXAtY = JAR_GEOMETRY.inner.radiusX * scaleX * (0.7 + 0.3 * relativeY);
      const curvedLeft = innerCenterX - radiusXAtY;
      const curvedRight = innerCenterX + radiusXAtY;

      if (x < curvedLeft && velocity.x < 0) {
        x = curvedLeft;
        velocity.x *= -BOUNCE_DAMPING;
      } else if (x > curvedRight && velocity.x > 0) {
        x = curvedRight;
        velocity.x *= -BOUNCE_DAMPING;
      }
    } else {
      // Neck collision (straight walls)
      if (x < wallLeft && velocity.x < 0) {
        x = wallLeft;
        velocity.x *= -BOUNCE_DAMPING;
      } else if (x > wallRight && velocity.x > 0) {
        x = wallRight;
        velocity.x *= -BOUNCE_DAMPING;
      }
    }

    // Check collision with fill level / bottom
    if (y >= baseY && velocity.y > 0) {
      if (phase === 'fall') {
        phase = 'enter';
      }

      if (Math.abs(velocity.y) < SETTLE_THRESHOLD && Math.abs(velocity.x) < SETTLE_THRESHOLD) {
        console.log('[COIN-JAR-DEBUG] PHASE_SETTLE_DIRECT', {
          prevPhase: gift.phase, y: Math.round(y), vy: Math.round(velocity.y * 100) / 100,
          baseY: Math.round(baseY), x: Math.round(x),
        });
        phase = 'settle';
        y = baseY;
        velocity.x = 0;
        velocity.y = 0;
      } else {
        // Bounce
        console.log('[COIN-JAR-DEBUG] PHASE_BOUNCE', {
          prevPhase: gift.phase, y: Math.round(y), vy: Math.round(velocity.y * 100) / 100,
          baseY: Math.round(baseY),
        });
        y = baseY;
        velocity.y *= -BOUNCE_DAMPING;
        velocity.x *= 0.8;
        phase = 'bounce';
      }
    }

    // Transition from bounce to settle
    if (phase === 'bounce' && Math.abs(velocity.y) < SETTLE_THRESHOLD && Math.abs(velocity.x) < SETTLE_THRESHOLD) {
      console.log('[COIN-JAR-DEBUG] PHASE_SETTLE_FROM_BOUNCE', {
        y: Math.round(y), vy: Math.round(velocity.y * 100) / 100,
        baseY: Math.round(baseY),
      });
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
export const MAX_ACCUMULATED_GIFTS = 100;

/**
 * Maximum falling gifts at once
 */
export const MAX_FALLING_GIFTS = 50;

/**
 * Create a new legacy particle (for backward compatibility with existing renderer)
 * Uses jar design dimensions (200×192, inner 35-165 × 22-184)
 */
export function createParticle(
  jarWidth: number,
  jarHeight: number,
  fillRatio: number
): Particle {
  const centerX = jarWidth / 2;
  const spread = jarWidth * 0.3;
  const scaleY = jarHeight / 192;
  const innerTop = JAR_GEOMETRY.inner.top * scaleY;
  const innerBottom = JAR_GEOMETRY.inner.bottom * scaleY;
  const innerHeight = innerBottom - innerTop;
  const maxFillHeight = innerHeight * 0.95;
  const baseY = innerBottom;
  const targetY = baseY - maxFillHeight * fillRatio + (Math.random() - 0.5) * (maxFillHeight * 0.1);

  return {
    id: `particle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: getRandomParticleType(),
    x: centerX + (Math.random() - 0.5) * spread,
    y: -50,
    targetX: centerX + (Math.random() - 0.5) * (jarWidth * 0.25),
    targetY: Math.max(innerTop, targetY),
    scale: 0.5 + Math.random() * 0.5,
    rotation: (Math.random() - 0.5) * 30,
    opacity: 0,
    animationState: 'entering',
  } as Particle & { targetX: number; targetY: number };
}