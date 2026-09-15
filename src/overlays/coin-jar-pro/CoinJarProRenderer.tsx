// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Coin Jar Pro Renderer
// ─────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RendererProps, OverlayEvent } from '../types';
import type { CoinJarProConfig, CoinJarState, RecentGift, Particle } from './types';
import { useCoinJarStore } from '../../store/coin-jar-store';
import {
  calculateFillRatio,
  formatCoins,
  createParticle,
  getParticleIconPath,
  getParticleColor,
  clamp,
  createFallingGift,
  updateFallingGiftPhysics,
  getGiftParticleType,
  getTargetAccumulationPosition,
} from './animations';
import type { FallingGift, AccumulatedGift } from './types';
import { MAX_FALLING_GIFTS, MAX_ACCUMULATED_GIFTS } from './animations';

// ─── Client-side gift image URL resolution ──────────────
// StreamToEarn URLs from their HTML are hash-based TikTok CDN URLs.
// The slug pattern (streamtoearn.io/assets/img/gifts/{slug}.png) does NOT work (404).
// We resolve from the client-side gift catalog which parses StreamToEarn HTML.
import { getGifts, getGiftsSync, getGiftImageUrl, preloadGiftCatalog, waitForCatalog, isCatalogLoaded, getCachedGiftImage, cacheGiftImage, invalidateGiftImage, isInvalidImageUrl, type TikTokGift } from '../../services/gift-service';

let giftCatalogCache: Map<string, TikTokGift> | null = null;

// ─── Blob URL Image Resolver ─────────────────────────────
// External image URLs (TikTok CDN, StreamToEarn) often fail to load directly
// in SVG <image> elements due to CORS, CSP, or mixed-content restrictions.
// Solution: fetch the image as a Blob, create a blob: URL, and use that.
// blob: URLs are same-origin and bypass cross-origin restrictions.
//
// Cache: Map<externalUrl, blobUrl>
// Pending: Map<externalUrl, Promise<blobUrl>> (dedupes simultaneous fetches)
// Cleanup: revoke blob URLs on unmount
// ──────────────────────────────────────────────────────────
const imageBlobCache = new Map<string, string>();
const imagePendingFetches = new Map<string, Promise<string>>();

async function resolveImageToBlobUrl(externalUrl: string): Promise<string> {
  // Return cached blob URL if available
  const cached = imageBlobCache.get(externalUrl);
  if (cached) {
    console.log('[COIN-JAR-IMAGE-RESOLVE-CACHE]', JSON.stringify({ externalUrl: externalUrl.slice(0, 100), cachedBlob: cached.slice(0, 60) }));
    return cached;
  }

  // Return existing pending fetch if already in flight (dedupe)
  const pending = imagePendingFetches.get(externalUrl);
  if (pending) return pending;

  // ═══ STEP 1: RESOLVE START ═══
  console.log('[COIN-JAR-IMAGE-RESOLVE-START]', JSON.stringify({
    originalUrl: externalUrl.slice(0, 200),
    protocol: (() => { try { return new URL(externalUrl).protocol; } catch { return 'parse-error'; } })(),
    hostname: (() => { try { return new URL(externalUrl).hostname; } catch { return 'parse-error'; } })(),
    locationProtocol: window.location.protocol,
    locationHostname: window.location.hostname,
    timestamp: Date.now(),
  }));

  // Start new fetch
  const fetchPromise = (async () => {
    try {
      // ═══ STEP 2: FETCH ═══
      console.log('[COIN-JAR-IMAGE-FETCH]', JSON.stringify({
        url: externalUrl.slice(0, 200),
        mode: 'cors',
        credentials: 'omit',
        timestamp: Date.now(),
      }));

      const response = await fetch(externalUrl, {
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow',
      });

      console.log('[COIN-JAR-IMAGE-FETCH-RESPONSE]', JSON.stringify({
        url: externalUrl.slice(0, 200),
        status: response.status,
        ok: response.ok,
        type: response.type,
        redirected: response.redirected,
        contentType: response.headers.get('content-type') || '(empty)',
        contentLength: response.headers.get('content-length') || '(empty)',
        timestamp: Date.now(),
      }));

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) throw new Error(`Not an image: ${contentType}`);

      // ═══ STEP 3: BLOB CREATION ═══
      const blob = await response.blob();
      console.log('[COIN-JAR-IMAGE-BLOB-CREATE]', JSON.stringify({
        url: externalUrl.slice(0, 200),
        blobSize: blob.size,
        blobType: blob.type,
        timestamp: Date.now(),
      }));

      // ═══ STEP 4: createObjectURL ═══
      const blobUrl = URL.createObjectURL(blob);
      imageBlobCache.set(externalUrl, blobUrl);

      console.log('[COIN-JAR-BLOB-URL]', JSON.stringify({
        originalUrl: externalUrl.slice(0, 200),
        generatedBlobUrl: blobUrl.slice(0, 100),
        blobSize: blob.size,
        mimeType: blob.type,
        timestamp: Date.now(),
      }));

      // ═══ STEP 5: TEST BLOB IN <img> ELEMENT ═══
      const testImg = new Image();
      testImg.onload = () => {
        console.log('[COIN-JAR-IMG-ELEMENT-TEST]', JSON.stringify({
          src: blobUrl.slice(0, 100),
          status: 'loaded',
          naturalWidth: testImg.naturalWidth,
          naturalHeight: testImg.naturalHeight,
          timestamp: Date.now(),
        }));
      };
      testImg.onerror = (e) => {
        console.error('[COIN-JAR-IMG-ELEMENT-TEST]', JSON.stringify({
          src: blobUrl.slice(0, 100),
          status: 'failed',
          error: String(e),
          timestamp: Date.now(),
        }));
      };
      testImg.src = blobUrl;

      return blobUrl;
    } catch (err) {
      console.error('[COIN-JAR-IMAGE-BLOB-FAILED]', JSON.stringify({
        originalUrl: externalUrl.slice(0, 200),
        error: String(err),
        errorName: err instanceof Error ? err.name : 'unknown',
        locationProtocol: window.location.protocol,
        locationHostname: window.location.hostname,
        navigator: navigator.userAgent.slice(0, 100),
        timestamp: Date.now(),
      }));
      // Fallback: return original URL so SVG can attempt direct load
      return externalUrl;
    } finally {
      imagePendingFetches.delete(externalUrl);
    }
  })();

  imagePendingFetches.set(externalUrl, fetchPromise);
  return fetchPromise;
}

function revokeAllBlobUrls(): void {
  for (const blobUrl of imageBlobCache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  imageBlobCache.clear();
  imagePendingFetches.clear();
}

function ensureGiftCatalog(): void {
  if (giftCatalogCache) return;
  // Try sync path first (catalog loaded from localStorage cache)
  const syncGifts = getGiftsSync();
  if (syncGifts && syncGifts.length > 0) {
    giftCatalogCache = new Map();
    syncGifts.forEach(g => {
      giftCatalogCache!.set(g.name.toLowerCase().trim(), g);
      if (g.giftId) giftCatalogCache!.set(g.giftId, g);
    });
    return;
  }
  // Async path: catalog not yet loaded, fire-and-forget
  getGifts().then(gifts => {
    giftCatalogCache = new Map();
    gifts.forEach(g => {
      giftCatalogCache!.set(g.name.toLowerCase().trim(), g);
      if (g.giftId) giftCatalogCache!.set(g.giftId, g);
    });
  }).catch(() => {});
}

function resolveGiftImageUrl(giftName: string, giftId?: string): string {
  // Priority 1: Local cache by giftId
  if (giftId) {
    const cached = getCachedGiftImage(giftId, '');
    if (cached && !isInvalidImageUrl(cached)) {
      console.log('[COIN-JAR-CATALOG-LOOKUP]', JSON.stringify({
        giftName, giftId, found: true, source: 'cache-by-id', resolvedImageUrl: cached.slice(0, 100),
      }));
      return cached;
    }
  }

  // Priority 2: Catalog lookup by giftId
  ensureGiftCatalog();
  if (giftCatalogCache && giftId) {
    const byId = giftCatalogCache.get(giftId);
    if (byId) {
      const url = getGiftImageUrl(byId);
      if (url) {
        cacheGiftImage(giftId, giftName, url);
        console.log('[COIN-JAR-CATALOG-LOOKUP]', JSON.stringify({
          giftName, giftId, found: true, source: 'catalog-by-id', resolvedImageUrl: url.slice(0, 100),
        }));
        return url;
      }
    }
  }

  // Priority 3: Local cache by giftName
  if (giftName) {
    const cached = getCachedGiftImage('', giftName);
    if (cached && !isInvalidImageUrl(cached)) {
      console.log('[COIN-JAR-CATALOG-LOOKUP]', JSON.stringify({
        giftName, giftId, found: true, source: 'cache-by-name', resolvedImageUrl: cached.slice(0, 100),
      }));
      return cached;
    }
  }

  // Priority 4: Catalog lookup by giftName
  if (giftCatalogCache && giftName) {
    const byName = giftCatalogCache.get(giftName.toLowerCase().trim());
    if (byName) {
      const url = getGiftImageUrl(byName);
      if (url) {
        cacheGiftImage(giftId || '', giftName, url);
        console.log('[COIN-JAR-CATALOG-LOOKUP]', JSON.stringify({
          giftName, giftId, found: true, source: 'catalog-by-name', resolvedImageUrl: url.slice(0, 100),
        }));
        return url;
      }
    }
  }

  // Priority 5: SVG fallback (empty = renderer uses path icon)
  console.log('[COIN-JAR-CATALOG-LOOKUP]', JSON.stringify({
    giftName, giftId, found: false, source: 'none',
    catalogLoaded: isCatalogLoaded(),
    catalogSize: giftCatalogCache ? giftCatalogCache.size : 0,
    note: 'ALL 5 priorities failed - will use SVG path fallback',
  }));
  return '';
}

// ─── Single Source of Truth: JAR GEOMETRY ──────────────────
// All dimensions in design space (base 200x200 coordinate system)
// The jar is centered at (100, 100) with the opening at top

interface JarGeometry {
  // Overall bounds
  centerX: number;
  centerY: number;
  width: number;
  height: number;

  // Body (main rounded vessel)
  body: {
    left: number;
    right: number;
    top: number;      // shoulder start
    bottom: number;   // bottom curve start
    centerX: number;
    radiusX: number;
    radiusY: number;
  };

  // Neck (narrow cylinder)
  neck: {
    left: number;
    right: number;
    top: number;      // rim bottom
    bottom: number;   // shoulder
    centerX: number;
  };

  // Opening/Rim (elliptical)
  opening: {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    rimThickness: number;
  };

  // Bottom thickness
  bottom: {
    centerY: number;
    radiusX: number;
    radiusY: number;
    thickness: number;
  };

  // Inner fillable area (for clipPath and gift positioning)
  inner: {
    left: number;
    right: number;
    top: number;      // just below rim
    bottom: number;   // inner bottom
    centerX: number;
    radiusX: number;  // varies with height (curved)
    radiusY: number;
  };

  // Glass highlights
  highlightLeft: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  highlightRight: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };

  // SVG Path strings
  paths: {
    outerJar: string;
    innerJar: string;
    neck: string;
    opening: string;
    bottom: string;
    innerBottom: string;
    highlightLeft: string;
    highlightRight: string;
  };
}

// ─── JAR GEOMETRY - Single Source of Truth ─────────────────
// Design space: 200x200. Jar occupies nearly the full space.
// Wide mason-jar body with narrow neck and thick rim.
const JAR_GEOMETRY: JarGeometry = {
  centerX: 100,
  centerY: 100,
  width: 200,
  height: 210,

  body: {
    left: 25,
    right: 175,
    top: 60,
    bottom: 190,
    centerX: 100,
    radiusX: 75,
    radiusY: 65,
  },

  neck: {
    left: 78,
    right: 122,
    top: 14,
    bottom: 30,
    centerX: 100,
  },

  opening: {
    centerX: 100,
    centerY: 8,
    radiusX: 30,
    radiusY: 8,
    rimThickness: 5,
  },

  bottom: {
    centerY: 193,
    radiusX: 75,
    radiusY: 6,
    thickness: 5,
  },

  inner: {
    left: 30,
    right: 170,
    top: 30,
    bottom: 192,
    centerX: 100,
    radiusX: 70,
    radiusY: 81,
  },

  highlightLeft: {
    left: 30,
    right: 55,
    top: 65,
    bottom: 165,
  },
  highlightRight: {
    left: 155,
    right: 170,
    top: 65,
    bottom: 160,
  },

  paths: {
    // Mason jar outer silhouette: rim → neck → shoulders → body → rounded bottom
    jar: `
      M 68 8
      Q 68 0, 100 0
      Q 132 0, 132 8
      L 132 14
      Q 122 14, 122 20
      L 122 30
      Q 175 30, 175 60
      L 175 170
      Q 175 196, 100 196
      Q 25 196, 25 170
      L 25 60
      Q 25 30, 78 30
      L 78 20
      Q 78 14, 68 14
      Z
    `,

    // Inner jar clipping boundary for gifts (insets ~5px from outer walls)
    jarInner: `
      M 80 34
      L 80 30
      Q 30 30, 30 60
      L 30 170
      Q 30 194, 100 194
      Q 170 194, 170 170
      L 170 60
      Q 170 30, 120 30
      L 120 34
      Z
    `,

    // Neck
    neck: `
      M 78 14
      Q 78 8, 100 8
      Q 122 8, 122 14
      L 122 30
      L 78 30
      Z
    `,

    // Rim opening (elliptical ring)
    opening: `
      M 68 12
      Q 68 2, 100 2
      Q 132 2, 132 12
      Q 132 20, 100 20
      Q 68 20, 68 12
      Z
    `,

    // Bottom thickness
    bottom: `
      M 35 190
      Q 35 196, 100 196
      Q 165 196, 165 190
      Z
    `,

    innerBottom: `
      M 40 188
      Q 40 194, 100 194
      Q 160 194, 160 188
      Z
    `,

    // Glass highlight left (vertical reflection stripe)
    highlightLeft: `
      M 35 65
      Q 35 55, 50 55
      L 55 55
      Q 55 65, 55 165
      Q 55 170, 50 170
      L 35 170
      Q 35 165, 35 65
      Z
    `,

    // Glass highlight right (subtle accent)
    highlightRight: `
      M 160 70
      L 165 70
      Q 165 65, 165 65
      L 168 65
      Q 170 65, 170 70
      L 170 160
      Q 170 165, 168 165
      L 165 165
      Q 165 165, 160 160
      Z
    `,
  },
};

// Export for use in other modules
export { JAR_GEOMETRY, type JarGeometry };

/**
 * Glass Jar Component — single SVG, one design-space coordinate system.
 *
 * viewBox="0 0 200 192" — the ENTIRE jar (rim, neck, body, bottom) lives here.
 * overflow="visible" so falling gifts above the jar (negative y) are rendered.
 * Everything uses design-space coordinates. No per-element scale transforms.
 *
 * Layer order:
 *   1. Liquid fill (clipped to jar interior)
 *   2. Accumulated gift images (clipped to jar interior)
 *   3. Falling gift images (not clipped, can be above jar)
 *   4. Glass body (transparent tint on top of gifts)
 *   5. Glass highlights
 *   6. Neck
 *   7. Rim
 *   8. Bottom
 */
const GlassJar: React.FC<{
  width: number;
  height: number;
  uid: string;
  fillRatio: number;
  fillStyle: 'gradient' | 'solid' | 'animated';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fallingGifts: FallingGift[];
  accumulatedGifts: AccumulatedGift[];
  accumulatedBlobRef: React.MutableRefObject<Map<string, string>>;
  accumulatedBlobPendingRef: React.MutableRefObject<Set<string>>;
  ensureAccumulatedBlobUrl: (url: string) => Promise<string>;
}> = ({
  width,
  height,
  uid,
  fillRatio,
  fillStyle,
  primaryColor,
  secondaryColor,
  accentColor,
  fallingGifts,
  accumulatedGifts,
  accumulatedBlobRef,
  accumulatedBlobPendingRef,
  ensureAccumulatedBlobUrl,
}) => {
  const DW = 200; // Design width (jar body spans ~25–175)
  const JAR_H = 192; // Jar design height (y=0 rim → y=192 bottom)
  const FALL_AREA = 70; // Extra space ABOVE jar for falling gifts
  const DH = JAR_H + FALL_AREA; // Total viewBox height (262)
  // Gift visual size in design-space units. Must stay small relative to jar
  // (jar body is 150px wide, 144px tall). 20px = ~13% of jar width.
  const GIFT_VISUAL_SIZE = 20;
  // viewBox origin: (0, -FALL_AREA) → jar stays at y=0..192, gifts use y=-70..0

  // Fill level in jar design space (unchanged)
  const innerTop = JAR_GEOMETRY.inner.top;     // 22
  const innerBottom = JAR_GEOMETRY.inner.bottom; // 184
  const innerH = innerBottom - innerTop;
  const fillH = innerH * 0.95 * fillRatio;
  const fillTop = innerBottom - fillH;

  const clipId = `${uid}-jar-inner-clip`;
  const gradId = `${uid}-jar-fill-grad`;

  // Falling gift animation — design space, starts ABOVE jar
  const renderFallingGift = (gift: FallingGift) => {
    const elapsed = Date.now() - gift.startTime;
    if (elapsed < 0) return null; // Cascade delay not yet elapsed
    const duration = 1800; // ms
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic

    // Gift starts ABOVE the jar and falls through the opening into the jar.
    // viewBox origin is (0, -70), so y=-50 is well above the jar rim (at y≈2).
    const startY = -50; // Clearly above the jar
    const openingY = 10; // Jar opening/rim area
    const endY = fillTop + (innerBottom - fillTop) * 0.4; // Middle of fill area inside jar
    const curY = startY + (endY - startY) * eased;
    // Small horizontal drift for natural motion
    const drift = Math.sin(eased * Math.PI) * 4;
    const curX = gift.x + drift;

    const rot = gift.rotation * (1 - eased);
    const opacity = progress > 0.85 ? 1 - ((progress - 0.85) / 0.15) : 1;
    // Scale: pop in at start, settle to 1.0x, shrink slightly as it enters jar
    const s = progress < 0.1 ? 0.5 + progress * 8 : // pop-in: 0.5→1.3
              progress > 0.7 ? 1.0 - ((progress - 0.7) / 0.3) * 0.3 : // shrink into jar
              1.0;
    const sz = GIFT_VISUAL_SIZE * gift.scale; // Design-space size, scaled per gift
    const url = gift.giftData?.giftImageUrl || '';
    const color = getParticleColor(gift.type, primaryColor, accentColor);

    // Log visual diagnostics on first frame
    if (progress < 0.05) {
      console.log('[COIN-JAR-VISUAL] FALLING_GIFT', {
        giftName: gift.giftData?.giftName,
        hasImageUrl: !!url,
        url: url ? url.slice(0, 80) : '(none)',
        startY, openingY, endY, curY, curX, size: sz, scale: s,
      });
    }

    return (
      <g key={gift.id} transform={`translate(${curX}, ${curY}) rotate(${rot}) scale(${s})`} opacity={opacity}>
        {url ? (
          <>
            {(() => {
              const hrefType = url.startsWith('blob:') ? 'blob' : url.startsWith('data:') ? 'data' : 'external';
              console.log('[COIN-JAR-SVG-IMAGE-SET]', JSON.stringify({
                giftName: gift.giftData?.giftName || '(empty)',
                giftId: gift.giftData?.giftId || '(empty)',
                href: url.slice(0, 200),
                hrefType,
                width: Math.round(sz), height: Math.round(sz),
                opacity: Math.round(opacity * 100) / 100,
                visibility: 'visible',
                locationHref: window.location.href,
              }));
              return null;
            })()}
            <image
              x={-sz / 2} y={-sz / 2} width={sz} height={sz}
              href={url}
              preserveAspectRatio="xMidYMid meet"
              onLoad={() => {
                console.log('[COIN-JAR-SVG-IMAGE-LOAD]', JSON.stringify({
                  giftName: gift.giftData?.giftName,
                  url: url.slice(0, 100),
                  hrefType: url.startsWith('blob:') ? 'blob' : url.startsWith('data:') ? 'data' : 'external',
                  protocol: (() => { try { return new URL(url).protocol; } catch { return 'parse-error'; } })(),
                  locationHref: window.location.href,
                }));
              }}
              onError={(e) => {
                console.error('[COIN-JAR-SVG-IMAGE-ERROR]', JSON.stringify({
                  giftName: gift.giftData?.giftName,
                  url: url.slice(0, 100),
                  hrefType: url.startsWith('blob:') ? 'blob' : url.startsWith('data:') ? 'data' : 'external',
                  protocol: (() => { try { return new URL(url).protocol; } catch { return 'parse-error'; } })(),
                  locationHref: window.location.href,
                  userAgent: navigator.userAgent.slice(0, 100),
                  svgWidth: Math.round(sz), svgHeight: Math.round(sz),
                  error: String(e),
                }));
              }}
            />
          </>
        ) : (
          <svg x={-sz / 2} y={-sz / 2} width={sz} height={sz} viewBox="0 0 24 24">
            <path d={getParticleIconPath(gift.type)} fill={color} />
          </svg>
        )}
      </g>
    );
  };

  // SVG viewBox: origin at (0, -FALL_AREA) so jar stays at y=0..192
  // and gifts start at y=-50 (above jar). Total viewBox height = JAR_H + FALL_AREA = 262.
  // SVG pixel dimensions stay the same — preserveAspectRatio="xMidYMid meet" scales
  // the content to fit, making the jar ~97% of original size with room above for gifts.
  // [COIN-JAR-SVG-RENDER] Log SVG state on first render
  if (typeof window !== 'undefined' && !(window as any).__coinJarSvgDiagnosticLogged) {
    (window as any).__coinJarSvgDiagnosticLogged = true;
    console.log('[COIN-JAR-SVG-RENDER]', JSON.stringify({
      width, height,
      svgWidth: width, svgHeight: height,
      viewBox: `0 ${-FALL_AREA} ${DW} ${DH}`,
      jarVisible: true,
      fallingCount: fallingGifts.length,
      accumulatedCount: accumulatedGifts.length,
      fillRatio,
      fillStyle,
      timestamp: Date.now(),
    }));
    // [COIN-JAR-VISUAL-STYLE] Log jar visual properties
    console.log('[COIN-JAR-VISUAL-STYLE]', JSON.stringify({
      jarStroke: 'rgba(255,255,255,0.6)',
      jarStrokeWidth: '2',
      jarStrokeOpacity: 0.6,
      jarFill: 'rgba(180,190,255,0.05)',
      jarFillOpacity: 0.05,
      rimStroke: 'rgba(255,255,255,0.7)',
      rimStrokeWidth: '3',
      neckStroke: 'rgba(255,255,255,0.35)',
      highlightLeftFill: 'rgba(255,255,255,0.08)',
      note: 'jar fill is subtle glass effect; stroke is visible for Browser Source',
    }));
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 ${-FALL_AREA} ${DW} ${DH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* ClipPath — jar interior, design-space coordinates, no transform */}
        <clipPath id={clipId}>
          <path d={JAR_GEOMETRY.paths.jarInner} />
        </clipPath>
      </defs>

      {/* ===== LAYER 2: Accumulated gifts (clipped to jar interior) ===== */}
      {accumulatedGifts.length > 0 && (() => {
        // Log accumulated render state (once per render, not per gift)
        if (typeof window !== 'undefined' && (window as any).__coinJarDebugAccumulated !== accumulatedGifts.length) {
          (window as any).__coinJarDebugAccumulated = accumulatedGifts.length;
          console.log('[COIN-JAR-DEBUG] ACCUMULATED_RENDER', {
            count: accumulatedGifts.length,
            gifts: accumulatedGifts.map(g => ({
              id: g.id,
              name: g.giftName || g.giftData?.giftName,
              hasImage: !!(g.giftImageUrl || g.giftData?.giftImageUrl),
              url: (g.giftImageUrl || g.giftData?.giftImageUrl || '').slice(0, 60),
              x: Math.round(g.x),
              y: Math.round(g.y),
              settled: g.settled,
            })),
          });
        }
        return true;
      })() && (
        <g clipPath={`url(#${clipId})`}>
          {accumulatedGifts.map((gift) => {
            const sz = GIFT_VISUAL_SIZE;
            // Resolve URL at render time — three-layer fallback + blob URL resolution
            const directUrl = gift.giftImageUrl || '';
            const nestedUrl = gift.giftData?.giftImageUrl || '';
            const catalogUrl = resolveGiftImageUrl(gift.giftName || gift.giftData?.giftName || '', gift.giftData?.giftId);
            const baseUrl = directUrl || nestedUrl || catalogUrl || '';

            // Use blob URL if available for this external URL
            const url = baseUrl.startsWith('blob:') ? baseUrl : (accumulatedBlobRef.current.get(baseUrl) || baseUrl);

            // Trigger blob URL resolution in background if needed
            if (baseUrl && !baseUrl.startsWith('blob:') && !accumulatedBlobPendingRef.current.has(baseUrl) && !accumulatedBlobRef.current.has(baseUrl)) {
              ensureAccumulatedBlobUrl(baseUrl);
            }

            // Log every accumulated gift render
            if (accumulatedGifts.length <= 20) {
              console.log('[COIN-JAR-FINAL-URL]', {
                id: gift.id,
                giftName: gift.giftName || gift.giftData?.giftName,
                giftId: gift.giftData?.giftId,
                directUrl: directUrl ? directUrl.slice(0, 60) : 'EMPTY',
                nestedUrl: nestedUrl ? nestedUrl.slice(0, 60) : 'EMPTY',
                catalogUrl: catalogUrl ? catalogUrl.slice(0, 60) : 'EMPTY',
                finalUrl: url ? url.slice(0, 60) : 'EMPTY',
                hasFinalUrl: Boolean(url),
              });
            }

            const color = getParticleColor(gift.type, primaryColor, accentColor);
            return (
              <g
                key={gift.id}
                transform={`translate(${gift.x}, ${gift.y}) rotate(${gift.rotation})`}
                opacity={gift.settled ? 1 : 0.8}
              >
                {url ? (
                  <image
                    x={-sz / 2} y={-sz / 2} width={sz} height={sz}
                    href={url}
                    preserveAspectRatio="xMidYMid meet"
                    onLoad={() => {
                      console.log('[COIN-JAR-SVG-IMAGE] LOADED', JSON.stringify({
                        giftName: gift.giftName || gift.giftData?.giftName,
                        url: url.slice(0, 80),
                        protocol: (() => { try { return new URL(url).protocol; } catch { return 'parse-error'; } })(),
                        hostname: (() => { try { return new URL(url).hostname; } catch { return 'parse-error'; } })(),
                      }));
                    }}
                    onError={(e) => {
                      console.error('[COIN-JAR-SVG-IMAGE] FAILED', JSON.stringify({
                        giftName: gift.giftName || gift.giftData?.giftName,
                        url: url.slice(0, 80),
                        protocol: (() => { try { return new URL(url).protocol; } catch { return 'parse-error'; } })(),
                        hostname: (() => { try { return new URL(url).hostname; } catch { return 'parse-error'; } })(),
                        error: String(e),
                      }));
                    }}
                  />
                ) : null}
              </g>
            );
          })}
        </g>
      )}

      {/* ===== LAYER 3: Falling gifts (not clipped, above jar is OK) ===== */}
      {fallingGifts.map(renderFallingGift)}

      {/* ===== LAYER 4: Glass body (visible jar outline) ===== */}
      <path
        d={JAR_GEOMETRY.paths.jar}
        fill="transparent"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ===== LAYER 6: Neck ===== */}
      <path
        d={JAR_GEOMETRY.paths.neck}
        fill="transparent"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Thread rings on neck (mason jar screw threads) */}
      {[18, 22, 26].map((ty) => (
        <line
          key={`thread-${ty}`}
          x1={78} y1={ty} x2={122} y2={ty}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      ))}

      {/* ===== LAYER 7: Rim ===== */}
      <path
        d={JAR_GEOMETRY.paths.opening}
        fill="transparent"
        stroke="rgba(255,255,255,1)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Inner rim highlight */}
      <ellipse
        cx={100} cy={8}
        rx={26} ry={5}
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.8"
      />

      {/* ===== LAYER 8: Bottom ===== */}
      <path
        d={JAR_GEOMETRY.paths.bottom}
        fill="rgba(255,255,255,0.1)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Particle Icon Component - renders individual animated particles
 * Uses native SVG transform instead of Framer Motion for reliable rendering.
 */
const ParticleIcon: React.FC<{
  particle: Particle;
  scale: number;
  primaryColor: string;
  accentColor: string;
  jarOffsetX: number;
  jarOffsetY: number;
}> = ({ particle, scale, primaryColor, accentColor }) => {
  const iconPath = getParticleIconPath(particle.type);
  const color = getParticleColor(particle.type, primaryColor, accentColor);
  const iconSize = 20 * scale * (particle.scale || 1);

  // Calculate opacity based on animation state
  const opacity = particle.animationState === 'entering' ? 0.9 : particle.animationState === 'settling' ? 1 : particle.opacity || 0.8;
  const svgScale = particle.animationState === 'entering' ? 0.6 : particle.scale || 1;

  // Position: use interpolated particle.x/y (now updated by animation loop)
  const renderX = particle.x;
  const renderY = particle.y;

  // Render as direct SVG path (avoids nested SVG viewport clipping)
  const pathScale = (iconSize / 24) * svgScale;

  return (
    <g
      transform={`translate(${renderX}, ${renderY}) scale(${pathScale})`}
      opacity={opacity}
    >
      <path
        d={iconPath}
        fill={color}
        filter="url(#particle-shadow)"
        transform={`translate(-12, -12)`}
      />
    </g>
  );
};

/**
 * Donor Notification Component
 */
const DonorNotification: React.FC<{
  gift: RecentGift;
  config: CoinJarProConfig;
  primaryColor: string;
  onComplete: () => void;
}> = ({ gift, config, primaryColor, onComplete }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 300);
    }, config.notificationDuration);
    return () => clearTimeout(timer);
  }, [config.notificationDuration, onComplete]);

  if (!visible || !gift) return null;

  const donorText = config.donorText
    .replace('{username}', gift.username || 'Anonymous')
    .replace('{avatar}', config.showAvatar ? '👤' : '');

  const giftText = config.giftText
    .replace('{giftName}', gift.giftName || 'Gift')
    .replace('{count}', String(gift.giftCount ?? 1))
    .replace('{coins}', formatCoins(gift.coinValue ?? 0));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          bottom: config.notificationPosition === 'bottom' ? 120 : undefined,
          top: config.notificationPosition === 'top' ? 120 : undefined,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            background: 'rgba(20, 20, 30, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(10px)',
            minWidth: 280,
            maxWidth: 400,
          }}
        >
          {config.showAvatar && (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${primaryColor}, ${config.color.secondary})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                color: 'white',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {gift.avatarUrl ? (
                <img src={gift.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                gift.username.charAt(0).toUpperCase()
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {donorText}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {giftText}
            </div>
          </div>
          {config.showCoinIcon && (
            <div style={{
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              color: '#1a1a1a',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(255, 215, 0, 0.3)',
            }}>
              {formatCoins(gift.coinValue)}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Coin Counter Display
 */
const CoinCounter: React.FC<{
  value: number;
  config: CoinJarProConfig;
  primaryColor: string;
  accentColor: string;
  label: string;
  className?: string;
}> = ({ value, config, primaryColor, accentColor: _accentColor, label, className }) => {
  if (!config.showTotalCoins && !config.showCoinIcon) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        fontFamily: config.font.fontFamily,
      }}
    >
      {label && (
        <div style={{
          fontSize: Math.max(10, config.font.fontSize * 0.7),
          color: 'rgba(255,255,255,0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 600,
        }}>
          {label}
        </div>
      )}
      <div style={{
        fontSize: Math.max(16, config.font.fontSize * 1.5),
        fontWeight: 800,
        color: primaryColor,
        textShadow: `0 0 20px ${primaryColor}80`,
        fontFamily: config.font.fontFamily,
      }}>
        {config.showCoinIcon ? '🪙 ' : ''}{formatCoins(value)}
      </div>
    </motion.div>
  );
};

/**
 * Goal Progress Display
 */
const GoalProgress: React.FC<{
  current: number;
  target: number;
  config: CoinJarProConfig;
  primaryColor: string;
  accentColor: string;
}> = ({ current, target, config, primaryColor, accentColor }) => {
  if (!config.showGoal) return null;

  const percentage = Math.min(Math.round((current / target) * 100), 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        fontFamily: config.font.fontFamily,
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 200,
        height: 6,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})`,
            borderRadius: 3,
          }}
        />
      </div>
      <div style={{
        fontSize: Math.max(10, config.font.fontSize * 0.6),
        color: 'rgba(255,255,255,0.6)',
        display: 'flex',
        gap: 8,
        fontWeight: 500,
      }}>
        <span>{formatCoins(current)} / {formatCoins(target)}</span>
        <span style={{ color: primaryColor }}>{percentage}%</span>
      </div>
    </motion.div>
  );
};

/**
 * Main Coin Jar Pro Renderer
 */
export const CoinJarProRenderer: React.FC<RendererProps<CoinJarProConfig> & { initialTotalCoins?: number }> = ({
  config,
  mode = 'preview',
  events,
  size,
  initialTotalCoins,
}) => {
  // Build marker — confirms new code is running
  console.log('[COIN-JAR-BUILD]', 'DYNAMIC-TIKTOK-CATALOG-IMAGE-FIX');

  // Animation completion tracking for demo mode
  const animationCompleteRef = useRef(false);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnimationCompleteRef = useRef(false);
  const mountedRef = useRef(true);

  // Guaranteed valid initial state factory — used by useState AND as fallback in every updater
  const makeDefaultState = useCallback((overrides?: Partial<CoinJarState>): CoinJarState => ({
    totalCoins: initialTotalCoins || 0,
    goalCoins: config.goalCoins,
    currentFill: calculateFillRatio(initialTotalCoins || 0, config.goalCoins, config.continueAfterGoal),
    recentGift: undefined,
    donors: [],
    particles: [],
    fallingGifts: [],
    accumulatedGifts: [],
    ...overrides,
  }), [initialTotalCoins, config.goalCoins, config.continueAfterGoal]);

  const [state, setState] = useState<CoinJarState>(() => makeDefaultState());

  // ═══════════════════════════════════════════════════════════
  // 3-WAY IMAGE COMPATIBILITY DIAGNOSTIC PANEL
  // Shows when a gift arrives — renders the same image 3 ways:
  //   1. <img src="blob-url">
  //   2. SVG <image href="blob-url">
  //   3. <img src="original-external-url">
  // This determines which browser rendering mechanism works in
  // TikTok LIVE Studio's embedded Chromium.
  // ═══════════════════════════════════════════════════════════
  interface DiagnosticGift {
    giftName: string;
    originalUrl: string;
    blobUrl: string;
    timestamp: number;
  }
  const [diagnosticGift, setDiagnosticGift] = useState<DiagnosticGift | null>(null);
  const [diagBlobImg, setDiagBlobImg] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [diagBlobSvg, setDiagBlobSvg] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [diagExternalImg, setDiagExternalImg] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const diagnosticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Called when a real gift arrives — populates the diagnostic panel
  const triggerDiagnostic = useCallback(async (giftName: string, originalUrl: string) => {
    // Resolve blob URL
    const blobUrl = await resolveImageToBlobUrl(originalUrl);
    const isBlob = blobUrl.startsWith('blob:');

    setDiagnosticGift({ giftName, originalUrl, blobUrl, timestamp: Date.now() });
    setDiagBlobImg('loading');
    setDiagBlobSvg('loading');
    setDiagExternalImg('loading');

    // Auto-hide after 15 seconds
    if (diagnosticTimerRef.current) clearTimeout(diagnosticTimerRef.current);
    diagnosticTimerRef.current = setTimeout(() => setDiagnosticGift(null), 15000);
  }, []);

  // Log compatibility summary when all 3 tests settle
  useEffect(() => {
    if (!diagnosticGift) return;
    const allSettled = diagBlobImg !== 'loading' || diagBlobSvg !== 'loading' || diagExternalImg !== 'loading';
    if (!allSettled) return;
    // Log summary after a short delay to let remaining tests settle
    const timer = setTimeout(() => {
      console.log('[COIN-JAR-IMAGE-COMPATIBILITY]', JSON.stringify({
        giftName: diagnosticGift.giftName,
        blobImg: diagBlobImg,
        blobSvg: diagBlobSvg,
        externalImg: diagExternalImg,
        originalUrl: diagnosticGift.originalUrl.slice(0, 200),
        blobUrl: diagnosticGift.blobUrl.slice(0, 100),
        locationHref: window.location.href,
        timestamp: Date.now(),
      }));
    }, 2000);
    return () => clearTimeout(timer);
  }, [diagBlobImg, diagBlobSvg, diagExternalImg, diagnosticGift]);

  // Blob URL resolution for accumulated gifts - runs async and updates state
  const accumulatedBlobRef = useRef<Map<string, string>>(new Map());
  const accumulatedBlobPendingRef = useRef<Set<string>>(new Set());

  const ensureAccumulatedBlobUrl = useCallback(async (externalUrl: string): Promise<string> => {
    if (!externalUrl || externalUrl.startsWith('blob:')) return externalUrl;
    const cached = accumulatedBlobRef.current.get(externalUrl);
    if (cached) return cached;
    if (accumulatedBlobPendingRef.current.has(externalUrl)) {
      // Wait for existing fetch to complete
      while (accumulatedBlobPendingRef.current.has(externalUrl)) {
        await new Promise(r => setTimeout(r, 50));
      }
      return accumulatedBlobRef.current.get(externalUrl) || externalUrl;
    }
    accumulatedBlobPendingRef.current.add(externalUrl);
    try {
      const blobUrl = await resolveImageToBlobUrl(externalUrl);
      accumulatedBlobRef.current.set(externalUrl, blobUrl);
      // Trigger re-render if blob URL is different
      if (blobUrl !== externalUrl) {
        setState(prev => {
          if (!prev) return prev;
          let changed = false;
          const newAccumulated = prev.accumulatedGifts.map(g => {
            const gUrl = g.giftImageUrl || g.giftData?.giftImageUrl || '';
            if (gUrl === externalUrl) {
              changed = true;
              return { ...g, giftImageUrl: blobUrl, giftData: g.giftData ? { ...g.giftData, giftImageUrl: blobUrl } : g.giftData };
            }
            return g;
          });
          const newFalling = prev.fallingGifts.map(g => {
            const gUrl = g.giftData?.giftImageUrl || '';
            if (gUrl === externalUrl) {
              changed = true;
              return { ...g, giftData: g.giftData ? { ...g.giftData, giftImageUrl: blobUrl } : g.giftData };
            }
            return g;
          });
          return changed ? { ...prev, accumulatedGifts: newAccumulated, fallingGifts: newFalling } : prev;
        });
      }
      return blobUrl;
    } catch {
      return externalUrl;
    } finally {
      accumulatedBlobPendingRef.current.delete(externalUrl);
    }
  }, []);

  // State recovery: if state becomes undefined (e.g. after ErrorBoundary retry),
  // reset to valid default. Use ref to prevent infinite recovery loop.
  const recoveredRef = useRef(false);
  useEffect(() => {
    if ((state === undefined || state === null) && !recoveredRef.current) {
      recoveredRef.current = true;
      console.error('[COIN-JAR-RECOVERY] state was undefined, resetting to default');
      setState(makeDefaultState());
    } else if (state !== undefined && state !== null) {
      recoveredRef.current = false;
    }
  });

  const [notificationQueue, setNotificationQueue] = useState<RecentGift[]>([]);
  const [currentNotification, setCurrentNotification] = useState<RecentGift | null>(null);

  const width = size?.width || 400;
  const height = size?.height || 400;

  // ── Visual diagnostic: log on renderer resize ──────────────
  // This allows us to determine whether visual problems are caused by
  // viewport, SVG scale, gift size, spawn position, or accumulation position.
  const prevSizeRef = useRef<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const prev = prevSizeRef.current;
    const jarDesignWidth = 200;
    const jarDesignHeight = 192;
    const viewBoxHeight = 262; // JAR_H + FALL_AREA
    const svgScale = Math.min(width / jarDesignWidth, height / viewBoxHeight);
    const giftScreenSize = Math.round(20 * svgScale); // GIFT_VISUAL_SIZE = 20

    if (!prev || prev.width !== width || prev.height !== height) {
      console.log('[COIN-JAR-VISUAL-SCALE]', JSON.stringify({
        viewportWidth: width,
        viewportHeight: height,
        rendererWidth: width,
        rendererHeight: height,
        jarWidth: Math.round(jarDesignWidth * svgScale),
        jarHeight: Math.round(jarDesignHeight * svgScale),
        giftVisualSize: 20,
        giftScreenSize,
        svgScale: Math.round(svgScale * 1000) / 1000,
      }));
      prevSizeRef.current = { width, height };
    }
  }, [width, height]);

  // Track mounted state + eagerly preload gift catalog to avoid cold-start race
  useEffect(() => {
    mountedRef.current = true;
    preloadGiftCatalog(); // sync from localStorage cache + async network refresh
    return () => {
      mountedRef.current = false;
      revokeAllBlobUrls(); // Cleanup blob URLs on unmount
    };
  }, []);

  // ── Pending gift queue for catalog race condition ──
  // When a gift arrives and catalog isn't ready, queue it.
  // Process the queue when catalog finishes loading.
  type PendingGift = {
    giftName: string; giftId: string; diamonds: number; repeatCount: number;
    username: string; giftImageUrl?: string; screenId?: string;
  };
  const pendingGiftsRef = useRef<PendingGift[]>([]);
  const catalogWaitActiveRef = useRef(false);

  // ── Sequential falling queue ──
  // Individual gifts wait here and are released one-by-one like rain.
  type QueuedGift = {
    giftName: string;
    giftId: string;
    giftImageUrl: string;
    username: string;
    diamondCount: number;
  };
  const fallingQueueRef = useRef<QueuedGift[]>([]);
  const activeUsernameRef = useRef<string>('');
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── RepeatCount delta tracking ──
  // TikTok's repeatCount is CUMULATIVE (total seen), not per-event delta.
  // For combo gifts, TikTok sends: event1(repeatEnd=0, repeatCount=N) → filtered,
  // then event2(repeatEnd=1, repeatCount=N+total) → passes filter.
  // Without delta tracking, N+total gifts are queued instead of just 1.
  // This ref tracks: `${giftId}:${username}` → last seen repeatCount.
  const lastRepeatCountRef = useRef<Map<string, number>>(new Map());

  // Blob URL resolution tracking - maps external URL to blob URL or Promise
  const blobUrlRef = useRef<Map<string, string | Promise<string>>>(new Map());

  const MAX_VISIBLE_FALLING = 8; // Max gifts falling simultaneously; excess stay queued

  const processPendingGifts = useCallback(() => {
    if (pendingGiftsRef.current.length === 0) return;
    const gifts = [...pendingGiftsRef.current];
    pendingGiftsRef.current = [];
    for (const g of gifts) {
      const testEvent: OverlayEvent = {
        type: 'gift', username: g.username, giftName: g.giftName,
        diamonds: g.diamonds, repeatCount: g.repeatCount,
        giftId: g.giftId, giftImageUrl: g.giftImageUrl, screenId: g.screenId,
      };
      console.log(`[COIN-JAR-TRACE][${g.giftId || 'none'}-${String(Date.now()).slice(-6)}] QUEUED_GIFT_PROCESSED`, { giftName: g.giftName });
      // Re-invoke handleEvent with the queued gift
      handleEventRef.current(testEvent);
    }
  }, []);

  // Wait for catalog then process pending gifts
  const waitForCatalogAndProcess = useCallback(async () => {
    if (catalogWaitActiveRef.current) return;
    catalogWaitActiveRef.current = true;
    const loaded = await waitForCatalog(3000);
    catalogWaitActiveRef.current = false;
    if (loaded && mountedRef.current) {
      processPendingGifts();
    }
  }, [processPendingGifts]);

  // Function to notify demo source after visual animations complete
  const notifyAnimationCompleteDelayed = useCallback(() => {
    if (!events || typeof events !== 'object' || !('_internal' in events)) return;

    const internal = (events as any)._internal;
    if (internal && typeof internal.notifyAnimationComplete === 'function') {
      console.log('[COIN-JAR-RENDERER] notifying demo source animation complete (delayed)');
      internal.notifyAnimationComplete();
    }
  }, [events]);

  // Track when particle animations complete
  const checkAnimationComplete = useCallback(() => {
    if (!pendingAnimationCompleteRef.current || !mountedRef.current) return;

    // Check if all particles have settled
    setState(prev => {
      const current = prev ?? makeDefaultState();
      const allSettled = current.particles.every(p => p.animationState === 'idle' || p.animationState === 'settling');
      if (allSettled && current.particles.length > 0) {
        pendingAnimationCompleteRef.current = false;
        // Schedule notification after a short delay to let final frame render
        if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
        animationTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            notifyAnimationCompleteDelayed();
          }
        }, 300);
      }
      return current;
    });
  }, [notifyAnimationCompleteDelayed]);

  // Sync goal coins from config
  useEffect(() => {
    setState(prev => ({
      ...makeDefaultState(),
      ...prev,
      goalCoins: config.goalCoins,
    }));
  }, [config.goalCoins, makeDefaultState]);

  // Update fill ratio when config changes (reads state via functional updater to avoid stale closures)
  useEffect(() => {
    setState(prev => {
      const current = prev ?? makeDefaultState();
      const fillRatio = calculateFillRatio(current.totalCoins, current.goalCoins, config.continueAfterGoal);
      return {
        ...current,
        currentFill: clamp(fillRatio, 0, config.continueAfterGoal ? 2 : 1),
      };
    });
  }, [state?.totalCoins, state?.goalCoins, config.continueAfterGoal, makeDefaultState]);

  // Ref to always have the latest handleEvent (for pending queue)
  const handleEventRef = useRef<(event: OverlayEvent) => void>(() => {});

  // Process incoming events
  const handleEvent = useCallback((event: OverlayEvent) => {
    // [COIN-JAR-DUPLICATE-TRACE] EVENT_HANDLER
    if ((event as any).type === 'gift') {
      console.log('[COIN-JAR-DUPLICATE-TRACE] EVENT_HANDLER', JSON.stringify({
        handlerId: 'CoinJarProRenderer',
        eventId: `${(event as any).giftId || 'none'}-${String(Date.now()).slice(-6)}`,
        giftName: (event as any).giftName || '(empty)',
        giftId: (event as any).giftId || '(empty)',
        repeatCount: (event as any).repeatCount || 1,
        source: (event as any)._source || 'unknown',
        timestamp: Date.now(),
      }));
    }

    // Track event source for session summary
    const eventSource = (event as any)._source || ((event as any).type === 'custom' ? 'sse' : 'unknown');
    if (eventSource === 'manual-test') sessionSummaryRef.current.manualEventsReceived++;
    else if (eventSource === 'demo') sessionSummaryRef.current.demoEventsReceived++;
    else if (eventSource === 'real-tiktok-live' || eventSource === 'sse') sessionSummaryRef.current.realEventsReceived++;

    console.log('[COIN-JAR-RENDERER] event received', {
      type: event.type,
      source: eventSource,
      username: 'username' in event ? event.username : undefined,
      giftName: 'giftName' in event ? event.giftName : undefined,
      diamonds: 'diamonds' in event ? event.diamonds : undefined,
      repeatCount: 'repeatCount' in event ? event.repeatCount : undefined,
      initialTotalCoins: initialTotalCoins !== undefined
    });

    // ── coin-jar-state: silent state hydration (no animation) ──
    if (event.type === 'custom' && (event as unknown as Record<string, unknown>).data) {
      const raw = event as unknown as { type: string; data: Record<string, unknown> };
      const d = raw.data;
      if (d.type === 'coin-jar-state' && typeof d.currentAmount === 'number') {
        console.log('[COIN-JAR-TRACE] state received (hydration)', { currentAmount: d.currentAmount, goalAmount: d.goalAmount, reset: d.reset });
        // On reset: clear accumulated/falling gifts immediately
        if (d.reset) {
          lastRepeatCountRef.current.clear();
          fallingQueueRef.current = [];
        }
        setState(prev => {
          const current = prev ?? makeDefaultState();
          const goalCoins = (typeof d.goalAmount === 'number' ? d.goalAmount : current.goalCoins);
          const fillRatio = calculateFillRatio(d.currentAmount, goalCoins, config.continueAfterGoal);
          return {
            ...current,
            totalCoins: d.currentAmount,
            goalCoins,
            currentFill: clamp(fillRatio, 0, config.continueAfterGoal ? 2 : 1),
            // On reset: clear all visual gift state
            ...(d.reset ? {
              accumulatedGifts: [],
              fallingGifts: [],
              particles: [],
              recentGift: undefined,
              donors: [],
            } : {}),
          };
        });
        return;
      }
    }

    // ── coin-jar-gift: animated gift accumulation ──
    if (event.type === 'custom' && (event as unknown as Record<string, unknown>).data) {
      const raw = event as unknown as { type: string; data: Record<string, unknown> };
      const d = raw.data;
      if (d.type === 'coin-jar-gift' && typeof d.currentAmount === 'number') {
        const giftData = (d.giftData as Record<string, unknown>) || {};
        const coinValue = (giftData.amount as number) || 0;
        const gdName = (giftData.giftName as string) || 'Gift';
        const gdId = (giftData.giftId as string) || '';
        const gdImageUrl = (giftData.giftImageUrl as string) || '';
        const eid = `${gdId || 'none'}-${String(Date.now()).slice(-6)}`;
        console.log('[COIN-JAR-REAL-LIVE][RENDERER]', JSON.stringify({
          giftId: gdId, giftName: gdName, giftImageUrl: gdImageUrl || '(empty)',
        }));
        console.log(`[COIN-JAR-TRACE][${eid}] BROWSER_SOURCE_RECEIVED`, { coinValue, giftName: gdName });

        // ── Catalog race condition: queue if image not ready ──
        const hasCachedUrl = gdId && getCachedGiftImage(gdId, gdName);
        if (!isCatalogLoaded() && !hasCachedUrl) {
          console.log(`[COIN-JAR-TRACE][${eid}] QUEUED (catalog loading)`, { giftName: gdName });
          pendingGiftsRef.current.push({
            giftName: gdName, giftId: gdId, diamonds: coinValue, repeatCount: 1,
            username: 'Gift',
          });
          waitForCatalogAndProcess();
          return; // Don't process yet — will be re-injected when catalog loads
        }

        // [COIN-JAR-REAL-TEST] RENDERER received coin-jar-gift from store
        console.log('[COIN-JAR-REAL-TEST] RENDERER coin-jar-gift received', {
          coinValue,
          previousAmount: state?.totalCoins || 0,
          newAmount: d.currentAmount,
          goalAmount: d.goalAmount,
          giftName: giftData.giftName,
          giftId: giftData.giftId,
        });

        // ── coin-jar-gift: STATE ONLY (no falling gift spawn) ──
        // Falling gifts are spawned exclusively by the standard 'gift' event handler
        // below. The coin-jar-gift event only updates the coin counter state.
        setState(prev => {
          const current = prev ?? makeDefaultState();
          const newTotal = d.currentAmount;
          const goalCoins = (typeof d.goalAmount === 'number' ? d.goalAmount : current.goalCoins);
          const newFillRatio = calculateFillRatio(newTotal, goalCoins, config.continueAfterGoal);

          const jarDesignWidth = 200;
          const jarDesignHeight = 192;
          const newParticles: Particle[] = [];
          const particleCount = Math.min(config.particleAmount, 4);
          for (let i = 0; i < particleCount; i++) {
            newParticles.push(createParticle(jarDesignWidth, jarDesignHeight, newFillRatio));
          }

          return {
            ...current,
            totalCoins: newTotal,
            goalCoins,
            currentFill: clamp(newFillRatio, 0, config.continueAfterGoal ? 2 : 1),
            particles: [...current.particles.slice(-30), ...newParticles].slice(-50),
          };
        });
        return;
      }
    }

    // ── Standard gift event ──
    if (event.type !== 'gift') return;

    // [REAL-GIFT-DEBUG][COIN-JAR-INPUT] Gift event reached CoinJarProRenderer
    console.log('[REAL-GIFT-DEBUG][COIN-JAR-INPUT]', JSON.stringify({
      type: event.type,
      screenId: (event as any).screenId || '(none)',
      giftId: (event as any).giftId || '(empty)',
      giftName: (event as any).giftName || '(empty)',
      repeatCount: (event as any).repeatCount || 1,
      diamondCount: (event as any).diamonds || 0,
      giftImageUrl: (event as any).giftImageUrl || '(empty)',
      username: (event as any).username || '(empty)',
      allKeys: Object.keys(event as any).slice(0, 15),
    }));

    // Extract gift data from OverlayEvent format
    const giftEvent = event as { type: 'gift'; username: string; giftName: string; diamonds: number; repeatCount?: number; giftImageUrl?: string; giftId?: string };
    const username = giftEvent.username || 'Anonymous';
    const giftName = giftEvent.giftName || 'Unknown Gift';
    const diamonds = giftEvent.diamonds || 0;
    const repeatCount = giftEvent.repeatCount || 1;
    const avatarUrl = undefined;
    const giftImageUrl = giftEvent.giftImageUrl || resolveGiftImageUrl(giftName, giftEvent.giftId);
    const eid = `${giftEvent.giftId || 'none'}-${String(Date.now()).slice(-6)}`;

    // ── Delta calculation (must be BEFORE coinValue) ──
    // TikTok's repeatCount can mean either:
    //   A) CUMULATIVE (total seen so far) — e.g. 5 Roses → single event with repeatCount=5
    //   B) PER-EVENT (this event's count) — e.g. 5 Roses → 5 events each with repeatCount=1
    // We handle BOTH: delta = max(0, repeatCount - prev), but if delta=0 AND repeatCount>=1,
    // it means TikTok sent a per-event count. We must still queue 1 gift.
    const giftKey = `${giftEvent.giftId || giftName}:${username}`;
    const prevRepeatCount = lastRepeatCountRef.current.get(giftKey) || 0;
    const rawDelta = repeatCount - prevRepeatCount;
    const deltaRepeatCount = Math.max(0, rawDelta);
    // If delta=0 but this is a valid gift event (repeatCount>=1), queue at least 1
    // This handles per-event repeatCount where each event has repeatCount=1
    const effectiveDelta = deltaRepeatCount > 0 ? deltaRepeatCount : 1;
    lastRepeatCountRef.current.set(giftKey, repeatCount);

    // Evict stale entries to prevent unbounded growth
    if (lastRepeatCountRef.current.size > 200) {
      const keys = Array.from(lastRepeatCountRef.current.keys());
      for (let i = 0; i < keys.length - 100; i++) {
        lastRepeatCountRef.current.delete(keys[i]);
      }
    }

    // [COIN-JAR-DUPLICATE-TRACE] DELTA_CALCULATION
    console.log('[COIN-JAR-DUPLICATE-TRACE] DELTA_CALCULATION', JSON.stringify({
      giftName,
      giftKey,
      rawRepeatCount: repeatCount,
      prevRepeatCount,
      deltaRepeatCount,
      note: deltaRepeatCount === 0 ? 'NO_NEW_GIFTS - will skip queue' : `Queueing ${deltaRepeatCount} gift(s)`,
    }));

    // Coin value uses effectiveDelta (at least 1 per event, or more for cumulative counts)
    const coinValue = diamonds * effectiveDelta;

    // [COIN-JAR-DROP-TRACE] RENDERER_DELTA — full trace for every gift event
    console.log('[COIN-JAR-DROP-TRACE] RENDERER_DELTA', JSON.stringify({
      giftName,
      giftId: giftEvent.giftId || '(empty)',
      username,
      rawRepeatCount: repeatCount,
      prevRepeatCount,
      rawDelta,
      deltaRepeatCount,
      effectiveDelta,
      coinValue,
      diamondCount: diamonds,
      giftKey,
      timestamp: Date.now(),
      analysis: deltaRepeatCount > 0
        ? `CUMULATIVE: delta=${deltaRepeatCount} gifts queued`
        : `PER-EVENT or DUPLICATE: forcing 1 gift (effectiveDelta=1)`,
    }));

    // ═══ DIAGNOSTIC: Trigger 3-way image compatibility test ═══
    if (giftImageUrl && giftImageUrl.startsWith('http')) {
      console.log('[COIN-JAR-BROWSER-GIFT]', JSON.stringify({
        giftName, giftId: giftEvent.giftId || '(empty)',
        giftImageUrl: giftImageUrl.slice(0, 200),
        eventTimestamp: Date.now(),
      }));
      // Skip visual diagnostic panel in browser-source mode (console logs only)
      if (mode !== 'browser-source') {
        triggerDiagnostic(giftName, giftImageUrl);
      }
    }

    // [COIN-JAR-GIFT-TRACE][RENDERER] Gift event received by renderer
    console.log('[COIN-JAR-GIFT-TRACE][RENDERER]', JSON.stringify({
      giftId: giftEvent.giftId || '(empty)',
      giftName,
      repeatCount,
      giftImageUrl: giftImageUrl || '(empty)',
      directUrl: giftEvent.giftImageUrl || '(empty)',
      resolvedUrl: resolveGiftImageUrl(giftName, giftEvent.giftId) || '(empty)',
      imageSource: giftEvent.giftImageUrl ? 'native-or-sse' : 'catalog-resolve',
      diamonds,
      coinValue,
    }));

    // [COIN-JAR-GIFT-TRACE][IMAGE-LOAD] Test the exact URL from the real event
    if (giftImageUrl) {
      const testImg = new Image();
      testImg.onload = () => {
        console.log('[COIN-JAR-GIFT-TRACE][IMAGE-LOAD]', JSON.stringify({
          status: 'LOADED',
          url: giftImageUrl.slice(0, 100),
          naturalWidth: testImg.naturalWidth,
          naturalHeight: testImg.naturalHeight,
          giftName,
        }));
      };
      testImg.onerror = () => {
        console.error('[COIN-JAR-GIFT-TRACE][IMAGE-LOAD]', JSON.stringify({
          status: 'FAILED',
          url: giftImageUrl.slice(0, 100),
          giftName,
          protocol: (() => { try { return new URL(giftImageUrl).protocol; } catch { return 'parse-error'; } })(),
          hostname: (() => { try { return new URL(giftImageUrl).hostname; } catch { return 'parse-error'; } })(),
        }));
        // ═══ PHASE 11: Network restriction diagnostics ═══
        console.error('[COIN-JAR-NETWORK-DIAG]', JSON.stringify({
          url: giftImageUrl,
          locationProtocol: window.location.protocol,
          locationHostname: window.location.hostname,
          locationHref: window.location.href,
          note: 'Image failed - check if TikTok LIVE Studio blocks external URLs',
        }));
      };
      testImg.src = giftImageUrl;
    }

    // ── USERNAME SESSION RESET ──
    // When a different user sends a gift, clear the jar completely.
    if (activeUsernameRef.current && activeUsernameRef.current !== username) {
      console.log('[COIN-JAR-SESSION]', JSON.stringify({
        previousUsername: activeUsernameRef.current,
        newUsername: username,
        reset: true,
      }));
      // Clear queue, falling, accumulated, coins, and repeatCount tracking
      fallingQueueRef.current = [];
      lastRepeatCountRef.current.clear();
      setState(prev => {
        const current = prev ?? makeDefaultState();
        return {
          ...current,
          totalCoins: 0,
          currentFill: 0,
          fallingGifts: [],
          accumulatedGifts: [],
          recentGift: undefined,
          donors: [],
          particles: [],
        };
      });
      // Broadcast reset to Browser Source via store (SSE)
      useCoinJarStore.getState().reset();
    }
    activeUsernameRef.current = username;

    // ── Catalog race condition ──
    if (!giftImageUrl && !isCatalogLoaded()) {
      console.log(`[COIN-JAR-TRACE][${eid}] QUEUED (catalog loading)`, { giftName });
      pendingGiftsRef.current.push({
        giftName, giftId: giftEvent.giftId || '', diamonds, repeatCount,
        username, giftImageUrl: giftEvent.giftImageUrl, screenId: giftEvent.screenId,
      });
      waitForCatalogAndProcess();
      return;
    }

    console.log('[COIN-JAR-QUEUE]', JSON.stringify({
      username,
      giftName,
      repeatCount,
      queued: fallingQueueRef.current.length,
      currentlyFalling: state?.fallingGifts?.filter(g => g.phase !== 'settle').length || 0,
      accumulated: state?.accumulatedGifts?.length || 0,
    }));

    // ── Queue individual gifts for sequential release ──
    // Each gift enters the queue; the queue processor releases them one-by-one like rain.
    // Uses effectiveDelta (calculated above) to queue gifts.
    const queueBefore = fallingQueueRef.current.length;

    for (let i = 0; i < effectiveDelta; i++) {
      fallingQueueRef.current.push({
        giftName,
        giftId: giftEvent.giftId || '',
        giftImageUrl: giftImageUrl || '',
        username,
        diamondCount: diamonds,
      });
    }

    // [COIN-JAR-DUPLICATE-TRACE] QUEUE_ADD
    console.log('[COIN-JAR-DUPLICATE-TRACE] QUEUE_ADD', JSON.stringify({
      giftName,
      repeatCount,
      queueBefore,
      queueAfter: fallingQueueRef.current.length,
      eventId: `${giftEvent.giftId || 'none'}-${String(Date.now()).slice(-6)}`,
      timestamp: Date.now(),
    }));

    // [REAL-GIFT-DEBUG][QUEUE-ADD] Gifts added to queue
    console.log('[REAL-GIFT-DEBUG][QUEUE-ADD]', JSON.stringify({
      giftName,
      giftId: giftEvent.giftId || '(empty)',
      repeatCount,
      queueBefore,
      queueAfter: fallingQueueRef.current.length,
      giftImageUrl: giftImageUrl || '(empty)',
      resolvedImageUrl: giftImageUrl || '(empty)',
    }));

    console.log('[COIN-JAR-QUEUE] QUEUED', JSON.stringify({
      giftName,
      repeatCount,
      totalQueued: fallingQueueRef.current.length,
    }));

    // ── Update coins immediately (visual gifts are released by queue processor) ──
    const recentGift: RecentGift = {
      username,
      avatarUrl,
      giftName,
      giftImageUrl,
      giftCount: repeatCount,
      coinValue,
      timestamp: Date.now(),
    };

    setState(prev => {
      const current = prev ?? makeDefaultState();
      const newTotal = current.totalCoins + coinValue;
      const newFillRatio = calculateFillRatio(newTotal, current.goalCoins, config.continueAfterGoal);

      const jarDesignWidth = 200;
      const jarDesignHeight = 192;
      const newParticles: Particle[] = [];
      const particleCount = Math.min(config.particleAmount, repeatCount * 2);
      for (let i = 0; i < particleCount; i++) {
        newParticles.push(createParticle(jarDesignWidth, jarDesignHeight, newFillRatio));
      }

      pendingAnimationCompleteRef.current = true;

      return {
        ...current,
        totalCoins: newTotal,
        currentFill: clamp(newFillRatio, 0, config.continueAfterGoal ? 2 : 1),
        recentGift,
        particles: [...current.particles.slice(-30), ...newParticles].slice(-50),
        donors: [
          {
            username,
            avatarUrl,
            totalCoins: newTotal,
            lastGift: recentGift,
          },
          ...current.donors.filter(d => d.username !== username).slice(0, 9),
        ],
      };
    });

    // Queue notification
    if (config.showDonorNotification) {
      setNotificationQueue(prev => [...prev, recentGift]);
    }
  }, [config, width, height, events, makeDefaultState]);

  // Sync handleEventRef so pending queue can re-invoke
  useEffect(() => { handleEventRef.current = handleEvent; }, [handleEvent]);

  // Subscribe to events — subscribe immediately when events source is available
  // The pending-gift queue handles the race condition when a gift arrives before catalog loads
  useEffect(() => {
    if (!events) {
      console.log('[COIN-JAR-RENDERER-DEMO] no events prop provided - mode=' + mode);
      return;
    }

    console.log('[COIN-JAR-RENDERER-DEMO] events prop received, mode=' + mode + ', subscribing immediately');
    let unsub: (() => void) | undefined;

    // Start catalog preload in background (non-blocking)
    preloadGiftCatalog();

    // Subscribe immediately — don't wait for catalog
    // handleEvent already queues gifts when catalog isn't loaded
    unsub = events.subscribe((event) => {
      console.log('[COIN-JAR-RENDERER-DEMO] EVENT RECEIVED type=' + event.type + ' mode=' + mode);
      handleEvent(event);
    });
    console.log('[COIN-JAR-RENDERER-DEMO] subscribed to events successfully');

    return () => {
      console.log('[COIN-JAR-RENDERER-DEMO] cleanup - unsubscribing');
      unsub?.();
    };
  }, [events, handleEvent, mode]);

  // Notification queue processor
  useEffect(() => {
    if (currentNotification || notificationQueue.length === 0) return;

    const next = notificationQueue[0];
    setCurrentNotification(next);
    setNotificationQueue(prev => prev.slice(1));
  }, [currentNotification, notificationQueue]);

  // Preview mode: we don't need auto-trigger since demo event source handles it
  useEffect(() => {
    if (mode !== 'preview') return;
    // Demo event source handles the preview loop, so we don't need this
  }, [mode]);

  // ── Falling queue processor ──
  // Releases gifts from fallingQueueRef into the renderer state.
  // Batches multiple gifts per tick so simultaneous arrivals start falling together.
  // Respects MAX_VISIBLE_FALLING to limit simultaneous animations.
  useEffect(() => {
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    queueTimerRef.current = setInterval(() => {
      const queue = fallingQueueRef.current;
      if (queue.length === 0) return;

      // Resolve blob URL BEFORE entering setState (setState must NOT be async)
      const nextGift = queue[0]; // peek, don't shift yet
      if (!nextGift) return;

      const resolveBlobUrlSync = (url: string): string => {
        if (!url || url.startsWith('blob:')) return url;
        const cached = blobUrlRef.current.get(url);
        if (cached && typeof cached === 'string') return cached;
        // If pending, fall through — will be resolved on next tick
        return url;
      };

      const resolvedGiftImageUrl = resolveBlobUrlSync(nextGift.giftImageUrl);

      // Fire-and-forget: resolve blob URL async for future gifts
      if (nextGift.giftImageUrl && !nextGift.giftImageUrl.startsWith('blob:') && !blobUrlRef.current.has(nextGift.giftImageUrl)) {
        const promise = resolveImageToBlobUrl(nextGift.giftImageUrl);
        blobUrlRef.current.set(nextGift.giftImageUrl, promise);
      }

      setState((prev) => {
        const current = prev ?? makeDefaultState();
        // Count gifts still in active animation (not settled)
        const activeFalling = current.fallingGifts.filter(g => g.phase !== 'settle').length;
        const availableSlots = MAX_VISIBLE_FALLING - activeFalling;
        if (availableSlots <= 0) return current; // wait for slots

        // Batch release: dequeue up to availableSlots gifts at once
        const batch: FallingGift[] = [];
        const jarDesignWidth = 200;
        const jarDesignHeight = 192;
        const newFillRatio = calculateFillRatio(current.totalCoins, current.goalCoins, config.continueAfterGoal);

        while (queue.length > 0 && batch.length < availableSlots) {
          const next = queue.shift()!;
          const viewBoxHeight = 262;
          const svgScale = Math.min(width / jarDesignWidth, height / viewBoxHeight);

          // Resolve blob URL synchronously before gift creation
          const resolvedUrl = resolveBlobUrlSync(next.giftImageUrl);

          const giftDataObj: import('./types').RecentGift = {
            username: next.username,
            giftName: next.giftName,
            giftImageUrl: resolvedUrl,
            giftCount: 1,
            coinValue: next.diamondCount,
            timestamp: Date.now(),
          };
          const fg = createFallingGift(jarDesignWidth, jarDesignHeight, newFillRatio, giftDataObj);

          console.log('[COIN-JAR-FALL] CREATED', JSON.stringify({
            giftId: fg.id, giftName: next.giftName,
            x: Math.round(fg.x), y: Math.round(fg.y),
            targetX: Math.round(fg.targetX), targetY: Math.round(fg.targetY),
            velocityY: fg.velocity.y, phase: fg.phase,
            batchIndex: batch.length, queueRemaining: queue.length,
          }));

          batch.push(fg);
        }

        if (batch.length === 0) return current;

        console.log('[COIN-JAR-QUEUE] BATCH_RELEASED', JSON.stringify({
          count: batch.length,
          activeBefore: activeFalling,
          activeAfter: activeFalling + batch.length,
          accumulated: current.accumulatedGifts.length,
          queueRemaining: queue.length,
          giftNames: batch.map(g => g.giftData?.giftName).join(', '),
        }));

        return {
          ...current,
          fallingGifts: [...current.fallingGifts, ...batch],
        };
      });
    }, 100);
    return () => {
      if (queueTimerRef.current) { clearInterval(queueTimerRef.current); queueTimerRef.current = null; }
    };
  }, [config.goalCoins, config.continueAfterGoal, makeDefaultState]);

  // Process particle animations: interpolate positions AND transition states
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const current = prev ?? makeDefaultState();
        const updatedParticles = current.particles.map(p => {
          // Interpolate position toward target based on animation state
          let { x, y, animationState, opacity } = p;
          if (animationState === 'entering') {
            // Fast approach: move 30% toward target each tick
            x = p.x + (p.targetX - p.x) * 0.3;
            y = p.y + (p.targetY - p.y) * 0.3;
            opacity = 0.9;
            // Transition to settling once reasonably close
            const dist = Math.hypot(p.targetX - x, p.targetY - y);
            if (dist < 20) {
              animationState = 'settling';
              opacity = 1;
            }
          } else if (animationState === 'settling') {
            // Gentle approach: move 15% toward target each tick
            x = p.x + (p.targetX - p.x) * 0.15;
            y = p.y + (p.targetY - p.y) * 0.15;
            opacity = 1;
            // Transition to idle once very close
            const dist = Math.hypot(p.targetX - x, p.targetY - y);
            if (dist < 3) {
              x = p.targetX;
              y = p.targetY;
              animationState = 'idle';
            }
          }
          // idle: no movement
          if (x !== p.x || y !== p.y || animationState !== p.animationState || opacity !== p.opacity) {
            return { ...p, x, y, animationState, opacity };
          }
          return p;
        });
        return { ...current, particles: updatedParticles };
      });
      // Check if animations are complete (for demo mode)
      checkAnimationComplete();
    }, 50);

    return () => clearInterval(interval);
  }, [checkAnimationComplete]);

  // Cleanup old particles periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => {
        const current = prev ?? makeDefaultState();
        return {
          ...current,
          particles: current.particles.slice(-40), // Keep only newest 40
          fallingGifts: current.fallingGifts.filter(g => g.phase !== 'settle').slice(-15),
          accumulatedGifts: current.accumulatedGifts.slice(-60),
        };
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Falling gift physics loop (requestAnimationFrame for smooth animation)
  useEffect(() => {
    let lastTime = performance.now();
    let rafId: number;
    let frameCount = 0;
    // Track initial y for first-movement diagnostics
    const firstYMap = new Map<string, number>();

    const tick = (now: number) => {
      const dt = Math.min(now - lastTime, 50); // Cap at 50ms to prevent large jumps
      lastTime = now;

      setState(prev => {
        const current = prev ?? makeDefaultState();
        const jarDesignWidth = 200; // Full design space width
        const jarDesignHeight = 192; // Full design space height (matches JAR_GEOMETRY)

        // Update falling gifts physics
        const updatedFallingGifts: FallingGift[] = [];
        const newAccumulatedGifts: AccumulatedGift[] = [];

        // Debug: log falling gift phases every 30 frames (~0.5s)
        frameCount++;
        if (frameCount % 30 === 0 && current.fallingGifts.length > 0) {
          for (const g of current.fallingGifts) {
            const elapsed = now - g.startTime;
            const innerTopD = JAR_GEOMETRY.inner.top;
            const innerBottomD = JAR_GEOMETRY.inner.bottom;
            const fillHD = (innerBottomD - innerTopD) * 0.95;
            const baseYD = innerBottomD - fillHD * current.currentFill;
            const dxToTarget = g.targetX !== undefined ? Math.round(g.x - g.targetX) : 'N/A';
            const dyToTarget = g.targetY !== undefined ? Math.round(g.y - g.targetY) : 'N/A';

            console.log('[COIN-JAR-DEBUG] PHYSICS_TICK', {
              id: g.id.slice(-10),
              name: g.giftData?.giftName,
              phase: g.phase,
              x: Math.round(g.x),
              y: Math.round(g.y),
              vy: Math.round(g.velocity.y * 100) / 100,
              vx: Math.round(g.velocity.x * 100) / 100,
              targetX: g.targetX !== undefined ? Math.round(g.targetX) : 'undef',
              targetY: g.targetY !== undefined ? Math.round(g.targetY) : 'undef',
              baseY: Math.round(baseYD),
              elapsed: Math.round(elapsed),
              dxToTarget,
              dyToTarget,
              shouldSettle: Math.abs(g.velocity.y) < 0.5 && Math.abs(g.velocity.x) < 0.5,
              yAboveBase: g.y >= baseYD,
            });
          }
        }

        for (const gift of current.fallingGifts) {
          // Diagnostic: log first movement for timing analysis
          if (!firstYMap.has(gift.id)) {
            firstYMap.set(gift.id, gift.y);
            console.log('[COIN-JAR-FALL] ANIMATION_START', JSON.stringify({
              giftId: gift.id.slice(-12), giftName: gift.giftData?.giftName,
              frame: frameCount, phase: gift.phase,
              x: Math.round(gift.x), y: Math.round(gift.y),
              targetX: Math.round(gift.targetX), targetY: Math.round(gift.targetY),
              velocityY: Math.round(gift.velocity.y * 100) / 100,
            }));
          } else if (gift.y !== firstYMap.get(gift.id) && !firstYMap.has(gift.id + '_moved')) {
            firstYMap.set(gift.id + '_moved', 1);
            console.log('[COIN-JAR-FALL] FIRST_MOVE', JSON.stringify({
              giftId: gift.id.slice(-12), giftName: gift.giftData?.giftName,
              frame: frameCount,
              startY: Math.round(firstYMap.get(gift.id)!),
              currentY: Math.round(gift.y),
              delta: Math.round(gift.y - firstYMap.get(gift.id)!),
              velocityY: Math.round(gift.velocity.y * 100) / 100,
              phase: gift.phase,
            }));
          }

          if (gift.phase === 'settle') {
            // Convert to accumulated gift — positions are in DESIGN SPACE (0-200, 0-190)
            if (current.accumulatedGifts.length + newAccumulatedGifts.length < MAX_ACCUMULATED_GIFTS) {
              // Get a fresh target position for this gift to settle at
              const targetPos = getTargetAccumulationPosition(
                jarDesignWidth, jarDesignHeight, current.currentFill,
                [...current.accumulatedGifts, ...newAccumulatedGifts]
              );
              // Explicitly preserve giftImageUrl as a top-level field — no dependency on nested giftData reference
              const srcGiftData = gift.giftData;
              const resolvedUrl = srcGiftData?.giftImageUrl || '';
              const resolvedName = srcGiftData?.giftName || 'Gift';
              const newAccGift: AccumulatedGift = {
                id: `acc-${gift.id}`,
                type: gift.type,
                x: gift.x,
                y: gift.y,
                targetX: targetPos.x,
                targetY: targetPos.y,
                scale: gift.scale * 0.8,
                rotation: gift.rotation,
                opacity: 1,
                giftData: srcGiftData || { username: 'Gift', giftName: resolvedName, giftImageUrl: resolvedUrl, giftCount: 1, coinValue: 0, timestamp: Date.now() },

                // [COIN-JAR-GIFT-TRACE][ACCUMULATED] Gift settled into jar
                giftImageUrl: resolvedUrl,
                giftName: resolvedName,
                giftImageUrl: resolvedUrl,
                timestamp: gift.startTime,
                settled: false,
              };
              newAccumulatedGifts.push(newAccGift);
              firstYMap.delete(gift.id);
              firstYMap.delete(gift.id + '_moved');
              console.log('[COIN-JAR-FALL] SETTLED', JSON.stringify({
                giftId: gift.id.slice(-12), giftName: resolvedName,
                frame: frameCount, elapsed: Math.round(performance.now() - gift.startTime),
                finalX: Math.round(targetPos.x), finalY: Math.round(targetPos.y),
              }));

              // [COIN-JAR-GIFT-TRACE][ACCUMULATED] Gift settled into jar
              console.log('[COIN-JAR-GIFT-TRACE][ACCUMULATED]', JSON.stringify({
                giftName: newAccGift.giftName,
                giftId: newAccGift.giftData?.giftId || '(empty)',
                giftImageUrl: newAccGift.giftImageUrl || '(empty)',
                resolvedFromNested: (newAccGift.giftData?.giftImageUrl || '').slice(0, 80) || '(empty)',
              }));

              console.log('[COIN-JAR-REAL-LIVE][ACCUMULATED]', JSON.stringify({
                id: newAccGift.id,
                giftName: newAccGift.giftName,
                giftId: newAccGift.giftData?.giftId,
                giftImageUrl: newAccGift.giftImageUrl || '(empty)',
                targetX: Math.round(targetPos.x),
                targetY: Math.round(targetPos.y),
              }));
              console.log('[COIN-JAR-DEBUG] CONVERTING_TO_ACCUMULATED', {
                id: gift.id,
                giftName: gift.giftData?.giftName,
                giftId: gift.giftData?.giftId,
                giftImageUrl: gift.giftData?.giftImageUrl ? gift.giftData.giftImageUrl.slice(0, 80) : 'EMPTY',
                targetX: Math.round(targetPos.x),
                targetY: Math.round(targetPos.y),
              });
              console.log('[COIN-JAR-FULL] FINAL_POSITION', JSON.stringify({
                giftId: gift.id,
                giftName: gift.giftData?.giftName,
                accumulatedCount: current.accumulatedGifts.length + newAccumulatedGifts.length,
                fallingCount: current.fallingGifts.length,
                targetX: Math.round(targetPos.x),
                targetY: Math.round(targetPos.y),
                currentX: Math.round(gift.x),
                currentY: Math.round(gift.y),
              }));
              console.log('[COIN-JAR-TRACE] ACCUMULATED_IMAGE_URL', {
                accId: newAccGift.id,
                giftName: newAccGift.giftData?.giftName,
                giftImageUrl: newAccGift.giftData?.giftImageUrl ? newAccGift.giftData.giftImageUrl.slice(0, 80) : 'EMPTY',
                hasGiftData: !!newAccGift.giftData,
                giftDataKeys: newAccGift.giftData ? Object.keys(newAccGift.giftData) : [],
              });
            }
            continue; // Don't keep the settled falling gift
          }
          updatedFallingGifts.push(
            updateFallingGiftPhysics(gift, jarDesignWidth, jarDesignHeight, current.currentFill, dt)
          );
        }

        // Settle accumulated gifts toward their targets
        const updatedAccumulatedGifts = [...current.accumulatedGifts, ...newAccumulatedGifts].map(g => {
          if (g.settled) return g;
          const dx = g.targetX - g.x;
          const dy = g.targetY - g.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 1) {
            return { ...g, x: g.targetX, y: g.targetY, settled: true };
          }
          const speed = 0.12;
          return { ...g, x: g.x + dx * speed, y: g.y + dy * speed };
        });

        // Only update state if something changed
        if (updatedFallingGifts.length !== current.fallingGifts.length ||
            updatedAccumulatedGifts.length !== current.accumulatedGifts.length ||
            updatedFallingGifts.some((g, i) => g !== current.fallingGifts[i])) {
          if (newAccumulatedGifts.length > 0) {
            console.log('[COIN-JAR-DEBUG] STATE_UPDATE', {
              prevAccumulated: current.accumulatedGifts.length,
              newAccumulated: updatedAccumulatedGifts.length,
              added: newAccumulatedGifts.length,
              fallingRemoved: current.fallingGifts.length - updatedFallingGifts.length,
            });
          }
          return {
            ...current,
            fallingGifts: updatedFallingGifts,
            accumulatedGifts: updatedAccumulatedGifts,
          };
        }
        return current;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Reset jar function — MUST be before any early return (React hooks rules)
  const handleReset = useCallback(() => {
    if (import.meta.env?.DEV) {
      console.debug('[CoinJarPro] reset');
    }
    lastRepeatCountRef.current.clear();
    fallingQueueRef.current = [];
    setState({
      totalCoins: 0,
      goalCoins: config.goalCoins,
      currentFill: 0,
      recentGift: undefined,
      donors: [],
      particles: [],
      fallingGifts: [],
      accumulatedGifts: [],
    });
    setNotificationQueue([]);
    setCurrentNotification(null);
    // Broadcast reset to Browser Source via store (SSE)
    useCoinJarStore.getState().reset();
  }, [config.goalCoins, makeDefaultState]);

  // Test gift function — MUST be before any early return
  // Uses async catalog fetch to guarantee catalog is loaded before building the event.
  // Picks a REAL catalog entry (not hardcoded) so it always works.
  const handleTest = useCallback(async () => {
    // Await catalog — works even if preload hasn't finished yet
    const catalog = await getGifts();
    if (!catalog?.length) {
      console.error('[COIN-JAR-TEST-SOURCE] CATALOG_LOAD_FAILED');
      return;
    }

    // Pick a real gift from the catalog — prefer one with an image URL
    const giftsWithImages = catalog.filter(g => getGiftImageUrl(g));
    const catalogEntry = giftsWithImages.length > 0
      ? giftsWithImages[0]  // First gift with a valid image
      : catalog[0];         // Fallback to first gift

    const testGiftName = catalogEntry.name;
    const resolvedGiftId = catalogEntry.giftId;
    const resolvedImageUrl = getGiftImageUrl(catalogEntry);

    console.log('[COIN-JAR-TEST-CATALOG]', JSON.stringify({
      name: catalogEntry.name,
      giftId: catalogEntry.giftId,
      coins: catalogEntry.coins,
      image: catalogEntry.image,
      cdnImage: catalogEntry.cdnImage,
      resolvedImageUrl,
      note: 'Using first available catalog entry with image',
    }));

    if (!resolvedGiftId) {
      console.error('[COIN-JAR-TEST-SOURCE] CATALOG_ENTRY_MISSING_GIFT_ID', {
        name: catalogEntry.name,
      });
      return;
    }

    if (!resolvedImageUrl) {
      console.error('[COIN-JAR-TEST-SOURCE] CATALOG_ENTRY_MISSING_IMAGE', {
        name: catalogEntry.name,
        giftId: catalogEntry.giftId,
        image: catalogEntry.image,
        cdnImage: catalogEntry.cdnImage,
      });
      return;
    }

    const testEvent: OverlayEvent = {
      type: 'gift',
      username: 'Test User 2',
      giftName: catalogEntry.name,
      diamonds: catalogEntry.coins,
      repeatCount: 2,
      giftId: resolvedGiftId,
      giftImageUrl: resolvedImageUrl,
    };

    console.log('[COIN-JAR-TEST-READY]', JSON.stringify({
      giftName: catalogEntry.name,
      giftId: resolvedGiftId,
      diamondCount: catalogEntry.coins,
      repeatCount: 2,
      giftImageUrl: resolvedImageUrl,
      imageSource: 'catalog',
    }));

    handleEvent(testEvent);
  }, [handleEvent]);

  // Real TikTok gift test injection — injects a normalized real gift event
  const handleRealGiftTest = useCallback((params: {
    giftName: string;
    giftId?: string;
    diamonds?: number;
    repeatCount?: number;
    username?: string;
  }) => {
    // Resolve image from catalog
    const catalog = getGiftsSync();
    const catalogEntry = catalog?.find(g => g.name.toLowerCase().trim() === params.giftName.toLowerCase().trim());
    const resolvedGiftId = catalogEntry?.giftId || params.giftId || 'manual-' + params.giftName;
    const resolvedImageUrl = catalogEntry ? getGiftImageUrl(catalogEntry) : '';

    console.log('[COIN-JAR-IMAGE-SOURCE] REAL_TEST_EVENT', JSON.stringify({
      giftId: resolvedGiftId,
      giftName: params.giftName,
      diamondCount: params.diamonds ?? 1,
      repeatCount: params.repeatCount ?? 1,
      giftImageUrl: resolvedImageUrl || '(empty)',
      imageSource: resolvedImageUrl ? 'catalog' : 'empty',
    }));

    const testEvent: OverlayEvent = {
      type: 'gift',
      username: params.username || 'TestUser',
      giftName: params.giftName,
      diamonds: params.diamonds ?? 1,
      repeatCount: params.repeatCount ?? 1,
      giftId: resolvedGiftId,
      giftImageUrl: resolvedImageUrl || undefined,
      screenId: 'screen-0',
    } as any;
    (testEvent as any)._source = 'manual-test';
    sessionSummaryRef.current.manualEventsReceived++;
    console.log('[COIN-JAR-REAL-TEST] MANUAL TEST INJECTION', testEvent);
    handleEvent(testEvent);
  }, [handleEvent]);

  // ── Live Verification Session Summary ──
  const sessionSummaryRef = useRef({
    realEventsReceived: 0, manualEventsReceived: 0, demoEventsReceived: 0,
    nativeImageUrlEvents: 0, nativeIconUrlEvents: 0,
    cacheImageEvents: 0, catalogImageEvents: 0, fallbackImageEvents: 0,
    duplicatesRejected: 0, successfulAnimations: 0, failedImageLoads: 0,
    lastRealTraces: [] as Array<Record<string, unknown>>,
  });

  // Expose test and reset for external access — MUST be before any early return
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__coinJarProTest = handleTest;
      (window as any).__coinJarProReset = handleReset;
      (window as any).__coinJarProRealGiftTest = handleRealGiftTest;

      // Inspect all images in the DOM and state
      (window as any).__coinJarInspectImages = () => {
        const allImages = [...document.querySelectorAll('image')];
        const accumulated = safeState.accumulatedGifts;
        const falling = safeState.fallingGifts;

        console.log('[COIN-JAR-IMAGE-INSPECT] ═══════════════════════════');
        console.log('[COIN-JAR-IMAGE-INSPECT] STATE');
        console.log(`  accumulatedGifts: ${accumulated.length}`);
        console.log(`  fallingGifts: ${falling.length}`);

        console.log('[COIN-JAR-IMAGE-INSPECT] ACCUMULATED GIFT DATA');
        accumulated.forEach((g, i) => {
          const url = g.giftImageUrl || g.giftData?.giftImageUrl || '';
          console.log(`  [${i}] id=${g.id.slice(-10)} name=${g.giftName || g.giftData?.giftName} url=${url ? url.slice(0, 70) : 'EMPTY'} directField=${!!g.giftImageUrl} nestedField=${!!(g.giftData?.giftImageUrl)}`);
        });

        console.log('[COIN-JAR-IMAGE-INSPECT] SVG <image> ELEMENTS');
        allImages.forEach((el, i) => {
          const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
          const rect = el.getBoundingClientRect();
          console.log(`  [${i}] href=${href ? href.slice(0, 70) : 'EMPTY'} visible=${rect.width > 0 && rect.height > 0} w=${Math.round(rect.width)} h=${Math.round(rect.height)} x=${Math.round(rect.x)} y=${Math.round(rect.y)}`);
        });

        console.log('[COIN-JAR-IMAGE-INSPECT] FALLING GIFT DATA');
        falling.forEach((g, i) => {
          const url = g.giftData?.giftImageUrl || '';
          console.log(`  [${i}] id=${g.id.slice(-10)} name=${g.giftData?.giftName} url=${url ? url.slice(0, 70) : 'EMPTY'} phase=${g.phase}`);
        });
        console.log('[COIN-JAR-IMAGE-INSPECT] ═══════════════════════════');
      };

      // DOM diagnostic — check actual SVG elements
      (window as any).__coinJarDebugDOM = () => {
        const images = document.querySelectorAll('image');
        const svgClipPaths = document.querySelectorAll('clipPath');
        const accumulated = safeState.accumulatedGifts;
        const falling = safeState.fallingGifts;
        console.log('[COIN-JAR-DEBUG] DOM_CHECK', {
          svgImageCount: images.length,
          clipPathCount: svgClipPaths.length,
          stateAccumulatedCount: accumulated.length,
          stateFallingCount: falling.length,
          accumulatedGifts: accumulated.map(g => ({
            id: g.id, name: g.giftData?.giftName,
            hasImage: !!g.giftData?.giftImageUrl,
            x: Math.round(g.x), y: Math.round(g.y),
            targetX: Math.round(g.targetX), targetY: Math.round(g.targetY),
            settled: g.settled,
          })),
          imageDetails: [...images].map(el => ({
            href: (el.getAttribute('href') || '').slice(0, 60),
            x: el.getAttribute('x'),
            y: el.getAttribute('y'),
            w: el.getAttribute('width'),
            h: el.getAttribute('height'),
          })),
        });
      };

      // Repeat test — injects Rose x10 and verifies all 10 accumulate
      (window as any).__coinJarRepeatTest = async () => {
        console.log('[COIN-JAR-REPEAT-TRACE] TEST_START', { giftName: 'Rose', repeatCount: 10 });

        // Reset
        handleReset();
        await new Promise(r => setTimeout(r, 500));

        const prevAccumulated = safeState.accumulatedGifts.length;

        // Inject Rose x10
        const testEvent: OverlayEvent = {
          type: 'gift', username: 'RepeatTest', giftName: 'Rose',
          diamonds: 1, repeatCount: 10, giftId: '5655',
        } as any;
        (testEvent as any)._source = 'repeat-test';
        handleEvent(testEvent);

        // Wait for all to settle (10 gifts × ~2.5s each, staggered 150ms = ~15s + buffer)
        console.log('[COIN-JAR-REPEAT-TRACE] WAITING_FOR_SETTLE...');
        await new Promise(r => setTimeout(r, 20000));

        const finalAccumulated = safeState.accumulatedGifts.length;
        const roseCount = safeState.accumulatedGifts.filter(g => g.giftData?.giftName === 'Rose').length;
        const coinIncrease = safeState.totalCoins;

        console.log('[COIN-JAR-REPEAT-TRACE] RESULT', {
          expected: 10,
          accumulatedTotal: finalAccumulated,
          roseCount,
          coinIncrease,
          passed: roseCount === 10 && coinIncrease === 10,
        });

        // DOM check
        const images = [...document.querySelectorAll('image')];
        console.log('[COIN-JAR-REPEAT-TRACE] DOM', {
          totalImages: images.length,
          urls: images.map(el => (el.getAttribute('href') || '').slice(0, 50)),
        });
      };

      // DOM diagnostic for repeat verification
      (window as any).__coinJarRepeatDOM = () => {
        const images = [...document.querySelectorAll('image')];
        const accumulated = safeState.accumulatedGifts;
        const falling = safeState.fallingGifts;
        console.log('[COIN-JAR-REPEAT-TRACE] DOM_CHECK', {
          stateAccumulatedCount: accumulated.length,
          stateFallingCount: falling.length,
          svgImageCount: images.length,
          accumulatedGifts: accumulated.map(g => ({
            id: g.id, name: g.giftData?.giftName,
            hasImage: !!g.giftData?.giftImageUrl,
            x: Math.round(g.x), y: Math.round(g.y), settled: g.settled,
          })),
          imageDetails: images.map(el => ({
            href: (el.getAttribute('href') || '').slice(0, 60),
            x: el.getAttribute('x'), y: el.getAttribute('y'),
          })),
        });
      };

      // Live verification diagnostic
      (window as any).__coinJarLiveVerificationReport = () => {
        const s = sessionSummaryRef.current;
        return { ...s, lastRealTraces: s.lastRealTraces.slice(-20) };
      };

      // Dynamic catalog test — tests N gifts from the real catalog, NOT hardcoded names
      (window as any).__coinJarTestGiftCatalog = async () => {
        console.log('[COIN-JAR-CATALOG-TEST] Starting...');

        // 1. Ensure catalog is loaded
        preloadGiftCatalog();
        const loaded = await waitForCatalog(5000);
        if (!loaded) {
          console.error('[COIN-JAR-CATALOG-TEST] FAILED: catalog did not load');
          return;
        }

        // 2. Get ALL gifts from catalog
        const allGifts = getGiftsSync();
        if (!allGifts || allGifts.length === 0) {
          console.error('[COIN-JAR-CATALOG-TEST] FAILED: catalog is empty');
          return;
        }

        const catalogCount = allGifts.length;
        console.log(`[COIN-JAR-CATALOG-TEST] catalogCount: ${catalogCount}`);

        // 3. Select 20 gifts dynamically from different catalog positions
        const TEST_COUNT = Math.min(20, catalogCount);
        const selectedGifts: typeof allGifts = [];
        for (let i = 0; i < TEST_COUNT; i++) {
          const idx = Math.floor((i / TEST_COUNT) * catalogCount);
          selectedGifts.push(allGifts[idx]);
        }

        // 4. Reset jar
        handleReset();
        await new Promise(r => setTimeout(r, 500));

        // 5. Test each gift sequentially
        let imageResolved = 0;
        let imageLoaded = 0;
        let animationsCompleted = 0;
        let failed = 0;
        const results: Array<{
          giftId: string; giftName: string; imageUrl: string;
          imageSource: string; imageLoaded: boolean; accumulated: boolean;
        }> = [];

        for (let i = 0; i < selectedGifts.length; i++) {
          const gift = selectedGifts[i];
          const giftId = gift.giftId || '';
          const giftName = gift.name || `Gift-${giftId}`;
          const imageUrl = getGiftImageUrl(gift) || '';
          const imageSource = imageUrl ? 'catalog' : 'fallback';

          console.log(`[COIN-JAR-CATALOG-TEST] [${i + 1}/${TEST_COUNT}] Testing: ${giftName} (${giftId})`);

          // Track image load state
          let imgLoaded = false;
          if (imageUrl) {
            const img = new Image();
            const loadPromise = new Promise<void>((resolve) => {
              img.onload = () => { imgLoaded = true; imageLoaded++; resolve(); };
              img.onerror = () => { imgLoaded = false; failed++; resolve(); };
              setTimeout(resolve, 5000); // 5s timeout per image
            });
            img.src = imageUrl;
            await loadPromise;
            imageResolved++;
          }

          // Inject gift event through the same pipeline as real TikTok events
          const testEvent: OverlayEvent = {
            type: 'gift',
            username: 'CatalogTest',
            giftName,
            diamonds: 10,
            repeatCount: 1,
            giftId,
            giftImageUrl: imageUrl || undefined,
            screenId: 'screen-0',
          } as any;
          (testEvent as any)._source = 'catalog-test';
          handleEvent(testEvent);

          // Wait for animation to settle (falling ~1.8s + settle ~0.5s)
          await new Promise(r => setTimeout(r, 2500));

          // Check accumulated state
          let accCount = 0;
          setState(prev => {
            accCount = (prev ?? makeDefaultState()).accumulatedGifts.length;
            return prev; // Don't modify state, just read
          });

          animationsCompleted++;

          const entry = {
            giftId, giftName,
            imageUrl: imageUrl ? imageUrl.slice(0, 80) : '(none)',
            imageSource, imageLoaded: imgLoaded,
            accumulated: accCount >= (i + 1),
          };
          results.push(entry);
          console.log(`[COIN-JAR-CATALOG-TEST] [${i + 1}]`, entry);
        }

        // 6. Final report
        const finalAccCount = state?.accumulatedGifts?.length || 0;
        console.log('[COIN-JAR-CATALOG-TEST] ═══════════════════════════');
        console.log('[COIN-JAR-CATALOG-TEST] FINAL REPORT');
        console.log('[COIN-JAR-CATALOG-TEST] ═══════════════════════════');
        console.log(`[COIN-JAR-CATALOG-TEST] catalogCount: ${catalogCount}`);
        console.log(`[COIN-JAR-CATALOG-TEST] tested: ${TEST_COUNT}`);
        console.log(`[COIN-JAR-CATALOG-TEST] imageResolved: ${imageResolved}`);
        console.log(`[COIN-JAR-CATALOG-TEST] imageLoaded: ${imageLoaded}`);
        console.log(`[COIN-JAR-CATALOG-TEST] animationsCompleted: ${animationsCompleted}`);
        console.log(`[COIN-JAR-CATALOG-TEST] accumulated: ${finalAccCount}`);
        console.log(`[COIN-JAR-CATALOG-TEST] failed: ${failed}`);
        console.table(results);
        console.log('[COIN-JAR-CATALOG-TEST] ═══════════════════════════');

        return {
          catalogCount, tested: TEST_COUNT, imageResolved, imageLoaded,
          animationsCompleted, accumulated: finalAccCount, failed, results,
        };
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__coinJarProTest;
        delete (window as any).__coinJarProReset;
        delete (window as any).__coinJarProRealGiftTest;
        delete (window as any).__coinJarLiveVerificationReport;
      }
    };
  }, [handleTest, handleReset, handleRealGiftTest]);

  // Cleanup timer on unmount — MUST be before any early return (was incorrectly inside JSX)
  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
      if (diagnosticTimerRef.current) {
        clearTimeout(diagnosticTimerRef.current);
      }
    };
  }, []);

  // All hooks must be called before any conditional return (React rules of hooks).
  const safeState = state ?? makeDefaultState();
  const displayFillRatio = Math.min(safeState.currentFill, 1);

  // Stable unique ID for SVG clipPath (avoids collision between multiple instances)
  const uidRef = useRef(`cjp-${Math.random().toString(36).slice(2, 8)}`);
  const uid = uidRef.current;

  // Jar container dimensions — use most of the viewport so jar is prominent
  const jarW = width * 0.92 * config.jarScale;
  const jarH = height * 0.92 * config.jarScale;

  // [COIN-JAR-VISUAL-STYLE] Outer container diagnostic (once per mount)
  if (typeof window !== 'undefined' && !(window as any).__coinJarContainerDiagnosticLogged) {
    (window as any).__coinJarContainerDiagnosticLogged = true;
    console.log('[COIN-JAR-VISUAL-STYLE]', JSON.stringify({
      outerOpacity: config.appearance.opacity,
      jarScale: config.jarScale,
      jarW: Math.round(jarW),
      jarH: Math.round(jarH),
      viewportWidth: width,
      viewportHeight: height,
      fillRatio: displayFillRatio,
      fillStyle: config.fillStyle,
      totalCoins: safeState.totalCoins,
      goalCoins: safeState.goalCoins,
      fallingGifts: safeState.fallingGifts.length,
      accumulatedGifts: safeState.accumulatedGifts.length,
      timestamp: Date.now(),
    }));
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        fontFamily: config.font.fontFamily,
      }}
    >
      {/* Main Jar Area — overflow visible so falling gifts above the SVG render */}
      <div style={{
        position: 'relative',
        width: jarW,
        height: jarH,
        transform: `translate(${config.jarPositionX}px, ${config.jarPositionY}px)`,
        overflow: 'visible',
      }}>
        {/* Single SVG: jar + liquid + accumulated gifts + falling gifts + glass overlay */}
        <GlassJar
          width={jarW}
          height={jarH}
          uid={uid}
          fillRatio={displayFillRatio}
          fillStyle={config.fillStyle}
          primaryColor={config.color.primary}
          secondaryColor={config.color.secondary}
          accentColor={config.color.accent}
          fallingGifts={safeState.fallingGifts}
          accumulatedGifts={safeState.accumulatedGifts}
          accumulatedBlobRef={accumulatedBlobRef}
          accumulatedBlobPendingRef={accumulatedBlobPendingRef}
          ensureAccumulatedBlobUrl={ensureAccumulatedBlobUrl}
        />

        {/* Coin counter sits below the jar in HTML space — hidden in browser-source and preview modes */}
        {mode !== 'browser-source' && mode !== 'preview' && (
          <div style={{ position: 'absolute', bottom: -40, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <CoinCounter
              value={safeState.totalCoins}
              config={config}
              primaryColor={config.color.primary}
              accentColor={config.color.accent}
              label="Total Coins"
              className="coin-total"
            />
          </div>
        )}
      </div>

      {/* Goal Progress (optional, positioned above jar) — hidden in browser-source and preview modes */}
      {mode !== 'browser-source' && mode !== 'preview' && config.showGoal && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <GoalProgress
            current={safeState.totalCoins}
            target={safeState.goalCoins}
            config={config}
            primaryColor={config.color.primary}
            accentColor={config.color.accent}
          />
        </div>
      )}

      {/* Latest Gift Coin Display — hidden in browser-source and preview modes */}
      {mode !== 'browser-source' && mode !== 'preview' && safeState.recentGift && (
        <CoinCounter
          value={safeState.recentGift.coinValue}
          config={config}
          primaryColor={config.color.primary}
          accentColor={config.color.accent}
          label="Latest Gift"
          className="coin-latest"
        />
      )}

      {/* Donor Notification — hidden in browser-source and preview modes */}
      {mode !== 'browser-source' && mode !== 'preview' && currentNotification && (
        <DonorNotification
          gift={currentNotification}
          config={config}
          primaryColor={config.color.primary}
          onComplete={() => setCurrentNotification(null)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════
          3-WAY IMAGE COMPATIBILITY DIAGNOSTIC PANEL
          Shows when a real gift arrives. Renders the same image 3 ways:
            1. <img src="blob-url">
            2. SVG <image href="blob-url">
            3. <img src="original-external-url">
          This determines which rendering mechanism works in TikTok LIVE Studio.
          ═══════════════════════════════════════════════════════════ */}
      {mode !== 'browser-source' && mode !== 'preview' && diagnosticGift && (() => {
        const imgStyle: React.CSSProperties = {
          width: 80, height: 80, objectFit: 'contain' as const,
          border: '2px solid rgba(255,255,255,0.3)', borderRadius: 8,
          background: 'rgba(0,0,0,0.5)',
        };
        const labelStyle: React.CSSProperties = {
          fontSize: 9, color: '#aaa', textAlign: 'center' as const, marginTop: 2,
        };
        return (
          <div style={{
            position: 'fixed', top: 4, right: 4, zIndex: 99999,
            background: 'rgba(0,0,0,0.92)', border: '1px solid rgba(0,255,0,0.4)',
            borderRadius: 8, padding: '8px 10px', pointerEvents: 'none',
            fontFamily: 'monospace', fontSize: 10, color: '#0f0', maxWidth: 320,
          }}>
            <div style={{ color: '#ff0', fontWeight: 'bold', marginBottom: 4, fontSize: 11 }}>
              IMAGE COMPAT DIAG — {diagnosticGift.giftName}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              {/* 1. BLOB IMG — HTML <img> with blob URL */}
              <div>
                <div style={imgStyle}>
                  <img
                    src={diagnosticGift.blobUrl}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onLoad={() => {
                      setDiagBlobImg('loaded');
                      console.log('[COIN-JAR-IMG-ELEMENT-TEST]', JSON.stringify({
                        src: diagnosticGift.blobUrl.slice(0, 100), status: 'loaded',
                        naturalWidth: 80, naturalHeight: 80, test: 'BLOB_IMG',
                      }));
                    }}
                    onError={(e) => {
                      setDiagBlobImg('failed');
                      console.error('[COIN-JAR-IMG-ELEMENT-TEST]', JSON.stringify({
                        src: diagnosticGift.blobUrl.slice(0, 100), status: 'failed',
                        test: 'BLOB_IMG', error: String(e),
                      }));
                    }}
                  />
                </div>
                <div style={{ ...labelStyle, color: diagBlobImg === 'loaded' ? '#0f0' : diagBlobImg === 'failed' ? '#f00' : '#ff0' }}>
                  BLOB IMG: {diagBlobImg}
                </div>
              </div>
              {/* 2. BLOB SVG — SVG <image> with blob URL */}
              <div>
                <div style={{ ...imgStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="76" height="76" viewBox="0 0 76 76">
                    <image
                      x="0" y="0" width="76" height="76"
                      href={diagnosticGift.blobUrl}
                      preserveAspectRatio="xMidYMid meet"
                      onLoad={() => {
                        setDiagBlobSvg('loaded');
                        console.log('[COIN-JAR-SVG-IMAGE-LOAD]', JSON.stringify({
                          href: diagnosticGift.blobUrl.slice(0, 100), status: 'loaded',
                          test: 'BLOB_SVG',
                        }));
                      }}
                      onError={(e) => {
                        setDiagBlobSvg('failed');
                        console.error('[COIN-JAR-SVG-IMAGE-ERROR]', JSON.stringify({
                          href: diagnosticGift.blobUrl.slice(0, 100), status: 'failed',
                          test: 'BLOB_SVG', error: String(e),
                          locationHref: window.location.href,
                          userAgent: navigator.userAgent.slice(0, 100),
                        }));
                      }}
                    />
                  </svg>
                </div>
                <div style={{ ...labelStyle, color: diagBlobSvg === 'loaded' ? '#0f0' : diagBlobSvg === 'failed' ? '#f00' : '#ff0' }}>
                  BLOB SVG: {diagBlobSvg}
                </div>
              </div>
              {/* 3. EXTERNAL IMG — HTML <img> with original external URL */}
              <div>
                <div style={imgStyle}>
                  <img
                    src={diagnosticGift.originalUrl}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onLoad={() => {
                      setDiagExternalImg('loaded');
                      console.log('[COIN-JAR-IMG-ELEMENT-TEST]', JSON.stringify({
                        src: diagnosticGift.originalUrl.slice(0, 100), status: 'loaded',
                        test: 'EXTERNAL_IMG',
                      }));
                    }}
                    onError={(e) => {
                      setDiagExternalImg('failed');
                      console.error('[COIN-JAR-IMG-ELEMENT-TEST]', JSON.stringify({
                        src: diagnosticGift.originalUrl.slice(0, 100), status: 'failed',
                        test: 'EXTERNAL_IMG', error: String(e),
                        protocol: (() => { try { return new URL(diagnosticGift.originalUrl).protocol; } catch { return 'parse-error'; } })(),
                      }));
                    }}
                  />
                </div>
                <div style={{ ...labelStyle, color: diagExternalImg === 'loaded' ? '#0f0' : diagExternalImg === 'failed' ? '#f00' : '#ff0' }}>
                  EXTERNAL IMG: {diagExternalImg}
                </div>
              </div>
            </div>
            {/* Compatibility summary */}
            <div style={{ color: '#fff', fontSize: 9, marginTop: 2 }}>
              [{diagBlobImg} / {diagBlobSvg} / {diagExternalImg}]
            </div>
            <button
              onClick={() => setDiagnosticGift(null)}
              style={{
                position: 'absolute', top: 2, right: 6,
                background: 'none', border: 'none', color: '#666',
                fontSize: 14, cursor: 'pointer', pointerEvents: 'auto',
              }}
            >×</button>
          </div>
        );
      })()}
    </div>
  );
};

export default memo(CoinJarProRenderer);