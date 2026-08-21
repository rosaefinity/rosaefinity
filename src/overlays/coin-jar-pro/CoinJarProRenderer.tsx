// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Coin Jar Pro Renderer
// ─────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RendererProps, OverlayEvent } from '../types';
import type { CoinJarProConfig, CoinJarState, RecentGift, Particle, AccumulatedGift, FallingGift } from './types';
import {
  calculateFillRatio,
  formatCoins,
  createParticle,
  getParticleIconPath,
  getParticleColor,
  clamp,
} from './animations';

// SVG Paths for the glass jar - improved realistic design
const JAR_SVG_PATHS = {
  // Glass jar body - more realistic shape
  jar: `
    M 50 85
    Q 50 45, 100 45
    Q 150 45, 150 85
    Q 150 145, 100 185
    Q 50 145, 50 85
    Z
  `,
  // Inner jar clipping mask (for gift accumulation)
  jarInner: `
    M 65 85
    Q 65 55, 100 55
    Q 135 55, 135 85
    Q 135 145, 100 180
    Q 65 145, 65 85
    Z
  `,
  // Glass highlight (left side - thick)
  highlightLeft: `
    M 58 85
    Q 58 58, 80 58
    Q 102 58, 102 85
    Q 102 115, 80 135
    Q 58 115, 58 85
    Z
  `,
  // Glass highlight (right side - subtle)
  highlightRight: `
    M 142 85
    Q 142 65, 120 65
    Q 98 65, 98 85
    Q 98 115, 120 128
    Q 142 115, 142 85
    Z
  `,
  // Jar neck
  neck: `
    M 68 45
    Q 68 22, 100 22
    Q 132 22, 132 45
    Q 132 52, 100 52
    Q 68 52, 68 45
    Z
  `,
  // Jar opening/rim
  opening: `
    M 72 28
    Q 72 16, 100 16
    Q 128 16, 128 28
    Q 128 34, 100 34
    Q 72 34, 72 28
    Z
  `,
  // Jar bottom thickness
  bottom: `
    M 50 185
    Q 50 192, 100 192
    Q 150 192, 150 185
    Q 150 178, 100 178
    Q 50 178, 50 185
    Z
  `,
  // Inner bottom (for fill clipping)
  innerBottom: `
    M 60 178
    Q 60 182, 100 182
    Q 140 182, 140 178
    Q 140 174, 100 174
    Q 60 174, 60 178
    Z
  `,
};

/**
 * Glass Jar Component - renders a realistic glass jar using SVG
 */
const GlassJar: React.FC<{
  width: number;
  height: number;
  fillRatio: number;
  fillStyle: 'gradient' | 'solid' | 'animated';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  particles: Particle[];
}> = ({
  width,
  height,
  fillRatio,
  fillStyle,
  primaryColor,
  secondaryColor,
  accentColor: _accentColor,
  particles,
} = {
  width,
  height,
  fillRatio,
  fillStyle,
  primaryColor,
  secondaryColor,
  accentColor,
  particles,
}) => {
  const scale = Math.min(width, height) / 200; // Base size is 200x200
  const jarWidth = 100 * scale;
  const jarHeight = 160 * scale;
  const centerX = width / 2;
  const centerY = height / 2 + jarHeight * 0.1;

  // Fill height calculation
  const maxFillHeight = jarHeight * 0.7; // 70% of jar is fillable
  const fillY = centerY + jarHeight * 0.15; // Bottom of fillable area
  const fillHeight = maxFillHeight * fillRatio;

  // Gradient definitions
  const gradientId = `jar-fill-gradient-${primaryColor.replace('#', '')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        {/* Fill gradient */}
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.9" />
          <stop offset="50%" stopColor={primaryColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.7" />
        </linearGradient>
        {/* Solid fill color */}
        <linearGradient id="jar-fill-solid" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={primaryColor} stopOpacity="0.85" />
          <stop offset="100%" stopColor={primaryColor} stopOpacity="0.65" />
        </linearGradient>
        {/* Animated shimmer */}
        <linearGradient id="jar-fill-animated" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.9" />
          <stop offset="50%" stopColor={primaryColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.7" />
          <animate attributeName="x1" values="0%;100%;0%" dur="3s" repeatCount="indefinite" />
          <animate attributeName="x2" values="0%;100%;0%" dur="3s" repeatCount="indefinite" />
        </linearGradient>
        {/* Glass reflection mask */}
        <mask id="jar-fill-mask">
          <rect x={centerX - jarWidth / 2 + 8 * scale} y={fillY - fillHeight} width={jarWidth - 16 * scale} height={fillHeight} fill="white" />
        </mask>
      </defs>

      <g transform={`translate(${centerX - 100 * scale}, ${centerY - 160 * scale})`}>
        {/* Jar Bottom Thickness */}
        <path
          d={JAR_SVG_PATHS.bottom}
          fill="rgba(255,255,255,0.1)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
          transform="scale(1)"
        />

        {/* Jar Body - Glass */}
        <path
          d={JAR_SVG_PATHS.jar}
          fill="rgba(255,255,255,0.05)"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1.5 * scale}
          filter="url(#glass-filter)"
        />

        {/* Fill Layer - Clipped to jar interior */}
        <g mask="url(#jar-fill-mask)">
          <rect
            x={8 * scale}
            y={fillY - (centerY - 160 * scale) - fillHeight}
            width={(100 - 16) * scale}
            height={fillHeight}
            fill={
              fillStyle === 'gradient' ? `url(#${gradientId})` :
              fillStyle === 'animated' ? 'url(#jar-fill-animated)' :
              'url(#jar-fill-solid)'
            }
            rx={4 * scale}
          >
            <animate
              attributeName="height"
              from="0"
              to={fillHeight}
              dur="0.5s"
              fill="freeze"
            />
            <animate
              attributeName="y"
              from={fillY - (centerY - 160 * scale)}
              to={fillY - (centerY - 160 * scale) - fillHeight}
              dur="0.5s"
              fill="freeze"
            />
          </rect>
        </g>

        {/* Particles inside the jar */}
        <g mask="url(#jar-fill-mask)">
          {particles.map((particle) => (
            <ParticleIcon
              key={particle.id}
              particle={particle}
              scale={scale}
              primaryColor={primaryColor}
              accentColor={accentColor}
              jarOffsetX={centerX - 100 * scale}
              jarOffsetY={centerY - 160 * scale}
            />
          ))}
        </g>

        {/* Glass Highlight Left */}
        <path
          d={JAR_SVG_PATHS.highlightLeft}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1 * scale}
          opacity={0.6}
        />

        {/* Glass Highlight Right */}
        <path
          d={JAR_SVG_PATHS.highlightRight}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.5 * scale}
          opacity={0.4}
        />

        {/* Jar Neck */}
        <path
          d={JAR_SVG_PATHS.neck}
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1.5 * scale}
        />

        {/* Jar Opening */}
        <path
          d={JAR_SVG_PATHS.opening}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={2 * scale}
        />

        {/* Inner rim highlight */}
        <ellipse
          cx={100 * scale}
          cy={35 * scale}
          rx={25 * scale}
          ry={5 * scale}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1 * scale}
        />
      </g>

      {/* Glass filter for subtle refraction effect */}
      <filter id="glass-filter" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="blur" />
        <feBlend in="SourceGraphic" in2="blur" mode="normal" />
      </filter>
    </svg>
  );
};

/**
 * Particle Icon Component - renders individual animated particles
 */
const ParticleIcon: React.FC<{
  particle: Particle & { targetX?: number; targetY?: number };
  scale: number;
  primaryColor: string;
  accentColor: string;
  jarOffsetX: number;
  jarOffsetY: number;
}> = ({ particle, scale, primaryColor, accentColor, jarOffsetX, jarOffsetY }) => {
  const iconPath = getParticleIconPath(particle.type);
  const color = getParticleColor(particle.type, primaryColor, accentColor);

  // Animation based on state
  const animateProps = particle.animationState === 'entering'
    ? { opacity: 1, scale: 1 }
    : particle.animationState === 'settling'
      ? { opacity: 1, scale: particle.scale }
      : { opacity: particle.opacity, scale: particle.scale };

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.3, rotate: particle.rotation }}
      animate={animateProps}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{
        transformOrigin: 'center center',
      }}
    >
      <svg
        width={24 * scale * particle.scale}
        height={24 * scale * particle.scale}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: jarOffsetX + particle.x - 12 * scale * particle.scale,
          top: jarOffsetY + particle.y - 12 * scale * particle.scale,
          pointerEvents: 'none',
        }}
      >
        <path
          d={iconPath}
          fill={color}
          opacity={particle.opacity}
          filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
        />
      </svg>
    </motion.g>
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

  if (!visible) return null;

  const donorText = config.donorText
    .replace('{username}', gift.username)
    .replace('{avatar}', config.showAvatar ? '👤' : '');

  const giftText = config.giftText
    .replace('{giftName}', gift.giftName)
    .replace('{count}', String(gift.giftCount))
    .replace('{coins}', formatCoins(gift.coinValue));

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
export const CoinJarProRenderer: React.FC<RendererProps<CoinJarProConfig>> = ({
  config,
  mode = 'preview',
  events,
  size,
}) => {
  const [state, setState] = useState<CoinJarState>({
    totalCoins: 0,
    goalCoins: config.goalCoins,
    currentFill: 0,
    recentGift: undefined,
    donors: [],
    particles: [],
  });

  const [notificationQueue, setNotificationQueue] = useState<RecentGift[]>([]);
  const [currentNotification, setCurrentNotification] = useState<RecentGift | null>(null);
  // const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Reserved for future use
  // const particleIdRef = useRef(0); // Reserved for future use

  const width = size?.width || 400;
  const height = size?.height || 400;

  // Sync goal coins from config
  useEffect(() => {
    setState(prev => ({
      ...prev,
      goalCoins: config.goalCoins,
    }));
  }, [config.goalCoins]);

  // Update fill ratio when totalCoins or goalCoins changes
  useEffect(() => {
    const fillRatio = calculateFillRatio(state.totalCoins, state.goalCoins, config.continueAfterGoal);
    setState(prev => ({
      ...prev,
      currentFill: clamp(fillRatio, 0, config.continueAfterGoal ? 2 : 1),
    }));
  }, [state.totalCoins, state.goalCoins, config.continueAfterGoal]);

  // Process incoming events
  const handleEvent = useCallback((event: OverlayEvent) => {
    if (event.type !== 'gift') return;

    // Extract gift data from OverlayEvent format
    const giftData = event.data as Record<string, unknown>;
    const username = (giftData.username as string) || 'Anonymous';
    const giftName = (giftData.giftName as string) || 'Unknown Gift';
    const diamonds = (giftData.diamonds as number) || 0;
    const repeatCount = (giftData.repeatCount as number) || 1;
    const avatarUrl = giftData.nickname as string | undefined;

    // Calculate coin value - use diamonds as coins directly
    const coinValue = diamonds * repeatCount;

    if (import.meta.env?.DEV) {
      console.debug('[CoinJarPro] gift received:', { username, giftName, repeatCount, coinValue });
    }

    const recentGift: RecentGift = {
      username,
      avatarUrl,
      giftName,
      giftCount: repeatCount,
      coinValue,
      timestamp: Date.now(),
    };

    // Update state
    setState(prev => {
      const newTotal = prev.totalCoins + coinValue;
      const newFillRatio = calculateFillRatio(newTotal, prev.goalCoins, config.continueAfterGoal);

      // Add new particles for the gift
      const newParticles: Particle[] = [];
      const particleCount = Math.min(config.particleAmount, repeatCount * 2);
      for (let i = 0; i < particleCount; i++) {
        newParticles.push(createParticle(width * 0.5, height * 0.7, newFillRatio));
      }

      if (import.meta.env?.DEV) {
        console.debug('[CoinJarPro] total coins:', newTotal);
        console.debug('[CoinJarPro] fill percentage:', newFillRatio * 100);
      }

      return {
        ...prev,
        totalCoins: newTotal,
        currentFill: clamp(newFillRatio, 0, config.continueAfterGoal ? 2 : 1),
        recentGift,
        particles: [...prev.particles.slice(-30), ...newParticles].slice(-50),
        donors: [
          {
            username,
            avatarUrl,
            totalCoins: newTotal,
            lastGift: recentGift,
          },
          ...prev.donors.filter(d => d.username !== username).slice(0, 9),
        ],
      };
    });

    // Queue notification
    if (config.showDonorNotification) {
      setNotificationQueue(prev => [...prev, recentGift]);
    }
  }, [config, width, height]);

  // Subscribe to events
  useEffect(() => {
    if (!events) return;

    const unsubscribe = events.subscribe(handleEvent);
    if (import.meta.env?.DEV) {
      console.debug('[CoinJarPro] mounted, subscribed to events');
    }
    return () => {
      unsubscribe();
      if (import.meta.env?.DEV) {
        console.debug('[CoinJarPro] unmounted, unsubscribed from events');
      }
    };
  }, [events, handleEvent]);

  // Notification queue processor
  useEffect(() => {
    if (currentNotification || notificationQueue.length === 0) return;

    const next = notificationQueue[0];
    setCurrentNotification(next);
    setNotificationQueue(prev => prev.slice(1));
  }, [currentNotification, notificationQueue]);

  // Preview mode: simulate a gift event
  useEffect(() => {
    if (mode !== 'preview') return;

    const timer = setTimeout(() => {
      const previewEvent: OverlayEvent = {
        type: 'gift',
        username: 'PreviewUser',
        giftName: 'Hand Hearts',
        diamonds: 100,
        repeatCount: 2,
      };
      // Manually trigger since we don't have events in preview
      handleEvent(previewEvent);
    }, 1000);

    return () => clearTimeout(timer);
  }, [mode, handleEvent]);

  // Process particle animations
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        particles: prev.particles.map(p => {
          if (p.animationState === 'entering') {
            return { ...p, animationState: 'settling', opacity: 1 };
          }
          if (p.animationState === 'settling') {
            return { ...p, animationState: 'idle' };
          }
          return p;
        }),
      }));
    }, 600);

    return () => clearInterval(interval);
  }, []);

  // Cleanup old particles periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        particles: prev.particles.slice(-40), // Keep only newest 40
      }));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fillRatio = state.currentFill;
  const displayFillRatio = Math.min(fillRatio, 1); // Visual fill capped at 100%

  // Reset jar function
  const handleReset = useCallback(() => {
    if (import.meta.env?.DEV) {
      console.debug('[CoinJarPro] reset');
    }
    setState({
      totalCoins: 0,
      goalCoins: config.goalCoins,
      currentFill: 0,
      recentGift: undefined,
      donors: [],
      particles: [],
    });
    setNotificationQueue([]);
    setCurrentNotification(null);
  }, [config.goalCoins]);

  // Test gift function
  const handleTest = useCallback(() => {
    const testEvent: OverlayEvent = {
      type: 'gift',
      username: 'Test User 2',
      giftName: 'Hand Hearts',
      diamonds: 100,
      repeatCount: 2,
    };
    handleEvent(testEvent);
  }, [handleEvent]);

  // Expose test and reset for external access (via window for testing)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__coinJarProTest = handleTest;
      (window as any).__coinJarProReset = handleReset;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__coinJarProTest;
        delete (window as any).__coinJarProReset;
      }
    };
  }, [handleTest, handleReset]);

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
      {/* Main Jar Area */}
      <div style={{
        position: 'relative',
        width: width * 0.85 * config.jarScale,
        height: height * 0.85 * config.jarScale,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translate(${config.jarPositionX}px, ${config.jarPositionY}px)`,
      }}>
        <GlassJar
          width={width * 0.85 * config.jarScale}
          height={height * 0.85 * config.jarScale}
          fillRatio={displayFillRatio}
          fillStyle={config.fillStyle}
          primaryColor={config.color.primary}
          secondaryColor={config.color.secondary}
          accentColor={config.color.accent}
          particles={state.particles}
        />

        {/* Total Coins Display (below jar) */}
        <CoinCounter
          value={state.totalCoins}
          config={config}
          primaryColor={config.color.primary}
          accentColor={config.color.accent}
          label="Total Coins"
          className="coin-total"
        />
      </div>

      {/* Goal Progress (optional, positioned) */}
      {config.showGoal && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <GoalProgress
            current={state.totalCoins}
            target={state.goalCoins}
            config={config}
            primaryColor={config.color.primary}
            accentColor={config.color.accent}
          />
        </div>
      )}

      {/* Latest Gift Coin Display (near bottom of jar) */}
      {state.recentGift && (
        <CoinCounter
          value={state.recentGift.coinValue}
          config={config}
          primaryColor={config.color.primary}
          accentColor={config.color.accent}
          label="Latest Gift"
          className="coin-latest"
        />
      )}

      {/* Donor Notification */}
      {currentNotification && (
        <DonorNotification
          gift={currentNotification}
          config={config}
          primaryColor={config.color.primary}
          onComplete={() => setCurrentNotification(null)}
        />
      )}

      {/* Debug controls in preview mode */}
      {mode === 'preview' && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          zIndex: 100,
        }}>
          <button
            onClick={handleTest}
            style={{
              padding: '8px 16px',
              background: config.color.primary,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Test Gift
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Reset Jar
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(CoinJarProRenderer);