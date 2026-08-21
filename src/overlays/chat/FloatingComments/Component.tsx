import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import type { FloatingCommentsConfig } from './types';
import type { OverlayEventSource, OverlayEvent } from '../../types';
import { BaseOverlay } from '../../base/BaseOverlay';

interface FloatingCommentsProps { config: FloatingCommentsConfig; mode: 'preview' | 'browser-source'; events?: OverlayEventSource; }

interface FloatingMsg { id: string; username: string; message: string; y: number; speed: number; rotation: number; born: number; }

function FloatingCommentsInner({ config, mode, events }: FloatingCommentsProps): React.ReactElement {
  const [msgs, setMsgs] = useState<FloatingMsg[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextY = useRef(0);

  const handleEvent = useCallback((event: OverlayEvent) => {
    if (event.type === 'comment' && 'message' in event) {
      const data = event as { type: 'comment'; username: string; message: string };
      const rotation = config.randomRotation ? (Math.random() - 0.5) * config.maxRotation * 2 : 0;
      const y = nextY.current % 100;
      nextY.current += 15 + Math.random() * 10;

      const msg: FloatingMsg = {
        id: `float-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        username: data.username, message: data.message, y,
        speed: config.speed * (0.8 + Math.random() * 0.4),
        rotation, born: Date.now(),
      };
      setMsgs(prev => [...prev, prev.length >= config.maxVisible ? prev.slice(1) : prev, msg]);
    }
  }, [config.maxVisible, config.randomRotation, config.maxRotation, config.speed]);

  useEffect(() => { if (!events) return; return events.subscribe(handleEvent); }, [events, handleEvent]);

  // Remove expired messages
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMsgs(prev => prev.filter(m => now - m.born < config.lifetime * 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [config.lifetime]);

  // Preview
  useEffect(() => {
    if (mode !== 'preview' || msgs.length > 0) return;
    const testMsgs = ['Hello! 🎉', 'Love this stream!', 'Great content 🔥', 'GG!', 'Awesome! 💜'];
    testMsgs.forEach((m, i) => {
      setTimeout(() => handleEvent({ type: 'comment', id: `t${i}`, source: 'test', priority: 0, timestamp: Date.now(), cancelable: false, data: {}, username: `User${i + 1}`, message: m } as OverlayEvent), 500 + i * 600);
    });
  }, [mode, msgs.length, handleEvent]);

  const isLTR = config.direction === 'left-to-right';

  return (
    <BaseOverlay config={config} mode={mode} instanceId="floating-comments" moduleId="floating-comments">
      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        {msgs.map(msg => {
          const age = (Date.now() - msg.born) / 1000;
          const lifetime = config.lifetime || 8;
          const progress = age / lifetime;
          const opacity = config.fadeEnabled ? Math.max(0, config.messageOpacity * (1 - progress)) : config.messageOpacity;
          const x = isLTR ? -100 + progress * 120 : 110 - progress * 120;

          return (
            <div key={msg.id} style={{
              position: 'absolute', top: `${msg.y}%`, left: `${x}%`,
              transform: `rotate(${msg.rotation}deg)`,
              opacity, whiteSpace: 'nowrap',
              fontFamily: config.fontFamily, fontSize: config.messageSize,
              fontWeight: config.fontWeight, color: config.colors.text,
              WebkitTextStroke: config.strokeEnabled ? `${config.strokeWidth}px ${config.strokeColor}` : 'none',
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              transition: 'left 0.1s linear',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {config.showAvatar && (
                <div style={{
                  width: config.avatarSize, height: config.avatarSize, borderRadius: '50%',
                  background: config.colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: config.avatarSize * 0.4, color: '#fff', flexShrink: 0,
                }}>
                  {msg.username[0]?.toUpperCase()}
                </div>
              )}
              <span style={{ color: config.usernameColor, fontWeight: 700 }}>{msg.username}</span>
              <span>{msg.message}</span>
            </div>
          );
        })}
      </div>
    </BaseOverlay>
  );
}

export const FloatingCommentsComponent = memo(FloatingCommentsInner);
