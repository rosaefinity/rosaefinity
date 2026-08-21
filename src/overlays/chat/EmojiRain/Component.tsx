import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import type { EmojiRainConfig } from './types';
import type { OverlayEventSource, OverlayEvent } from '../../types';
import { BaseOverlay } from '../../base/BaseOverlay';

interface EmojiRainProps { config: EmojiRainConfig; mode: 'preview' | 'browser-source'; events?: OverlayEventSource; }

interface Particle { id: string; emoji: string; x: number; y: number; vx: number; vy: number; scale: number; rotation: number; born: number; }

function EmojiRainInner({ config, mode, events }: EmojiRainProps): React.ReactElement {
  const [particles, setParticles] = useState<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const lastTime = useRef(performance.now());

  const spawnParticles = useCallback((emojis: string[]) => {
    const newParticles: Particle[] = [];
    const count = Math.min(config.particleCount, 20);
    for (let i = 0; i < count; i++) {
      const emoji = emojis[Math.floor(Math.random() * emojis.length)] ?? config.fallbackEmoji;
      newParticles.push({
        id: `p-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 4)}`,
        emoji,
        x: config.spawnArea === 'random' ? Math.random() * 100 : 10 + Math.random() * 80,
        y: config.spawnArea === 'random' ? Math.random() * 30 : -5,
        vx: (Math.random() - 0.5) * config.wind * 2,
        vy: 1 + Math.random() * 2,
        scale: config.randomScale ? config.minScale + Math.random() * (config.maxScale - config.minScale) : 1,
        rotation: config.randomRotation ? (Math.random() - 0.5) * 60 : 0,
        born: performance.now(),
      });
    }
    setParticles(prev => [...prev, ...newParticles].slice(-100));
  }, [config]);

  const handleEvent = useCallback((event: OverlayEvent) => {
    if (event.type === 'comment' && 'message' in event) {
      const data = event as { type: 'comment'; message: string };
      let emojis: string[];
      if (config.extractFromMessage) {
        const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
        emojis = data.message.match(emojiRegex) ?? [];
        if (emojis.length === 0) emojis = [config.fallbackEmoji];
      } else {
        emojis = [config.fallbackEmoji];
      }
      spawnParticles(emojis);
    }
  }, [config.extractFromMessage, config.fallbackEmoji, spawnParticles]);

  useEffect(() => { if (!events) return; return events.subscribe(handleEvent); }, [events, handleEvent]);

  // Physics loop
  useEffect(() => {
    const animate = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime.current) / 1000, 0.05);
      lastTime.current = now;

      setParticles(prev => prev
        .map(p => ({
          ...p,
          x: p.x + p.vx * dt * 10,
          y: p.y + p.vy * dt * config.gravity * 20,
          vy: p.vy + config.gravity * dt * 5,
          rotation: p.rotation + dt * 30,
        }))
        .filter(p => p.y < 110 && (now - p.born) < config.lifetime * 1000)
      );

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [config.gravity, config.lifetime]);

  // Preview
  useEffect(() => {
    if (mode !== 'preview' || particles.length > 0) return;
    const t = setTimeout(() => {
      handleEvent({ type: 'comment', id: 't1', source: 'test', priority: 0, timestamp: Date.now(), cancelable: false, data: {}, username: 'test', message: '🎉🔥❤️' } as OverlayEvent);
    }, 1000);
    return () => clearTimeout(t);
  }, [mode, particles.length, handleEvent]);

  return (
    <BaseOverlay config={config} mode={mode} instanceId="emoji-rain" moduleId="emoji-rain">
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
        {particles.map(p => (
          <div key={p.id} style={{
            position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
            transform: `scale(${p.scale}) rotate(${p.rotation}deg)`,
            fontSize: 24 * p.scale, willChange: 'transform',
            opacity: Math.max(0, 1 - (performance.now() - p.born) / (config.lifetime * 1000)),
          }}>
            {p.emoji}
          </div>
        ))}
      </div>
    </BaseOverlay>
  );
}

export const EmojiRainComponent = memo(EmojiRainInner);
