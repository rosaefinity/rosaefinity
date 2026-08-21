import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import type { GiftQueueConfig } from './types';
import type { OverlayEventSource, OverlayEvent } from '../../types';
import { BaseOverlay } from '../../base/BaseOverlay';

interface GiftQueueProps { config: GiftQueueConfig; mode: 'preview' | 'browser-source'; events?: OverlayEventSource; }

interface QueueItem { id: string; username: string; giftName: string; diamonds: number; repeatCount: number; timestamp: number; }

function GiftQueueInner({ config, mode, events }: GiftQueueProps): React.ReactElement {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processQueue = useCallback(() => {
    if (current) return;
    let nextItem: QueueItem | null = null;
    setQueue(prev => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = config.priorityMode === 'highest-value'
        ? [...prev].sort((a, b) => b.diamonds - a.diamonds)
        : prev;
      nextItem = next;
      return rest;
    });
    if (nextItem) setCurrent(nextItem);
  }, [current, config.priorityMode]);

  useEffect(() => {
    if (!current || !config.autoPlay) return;
    timerRef.current = setTimeout(() => setCurrent(null), config.playDuration * 1000) as unknown as ReturnType<typeof setInterval>;
    return () => { if (timerRef.current) clearTimeout(timerRef.current as unknown as number); };
  }, [current, config.playDuration, config.autoPlay]);

  useEffect(() => { processQueue(); }, [processQueue, queue]);

  const handleEvent = useCallback((event: OverlayEvent) => {
    if (event.type === 'gift' && 'giftName' in event) {
      const data = event as { type: 'gift'; username: string; giftName: string; diamonds: number; repeatCount: number; timestamp: number };
      const item: QueueItem = { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, username: data.username, giftName: data.giftName, diamonds: data.diamonds, repeatCount: data.repeatCount, timestamp: data.timestamp };
      setQueue(prev => {
        const base = prev.length >= config.maxQueueSize ? prev.slice(1) : prev;
        return [...base, item];
      });
    }
  }, [config.maxQueueSize]);

  useEffect(() => {
    if (!events) return;
    return events.subscribe(handleEvent);
  }, [events, handleEvent]);

  useEffect(() => {
    if (mode !== 'preview') return;
    const t = setTimeout(() => {
      handleEvent({ type: 'gift', id: 't1', source: 'test', priority: 0, timestamp: Date.now(), cancelable: false, data: {}, username: 'Alice', giftName: 'Rose', diamonds: 10, repeatCount: 1 } as OverlayEvent);
      setTimeout(() => handleEvent({ type: 'gift', id: 't2', source: 'test', priority: 0, timestamp: Date.now(), cancelable: false, data: {}, username: 'Bob', giftName: 'Diamond', diamonds: 100, repeatCount: 1 } as OverlayEvent), 200);
    }, 1000);
    return () => clearTimeout(t);
  }, [mode, handleEvent]);

  const display = current || queue[0];

  return (
    <BaseOverlay config={config} mode={mode} instanceId="gift-queue" moduleId="gift-queue">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
        {display ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: 'rgba(255,255,255,0.05)', borderRadius: config.border.radius, animation: 'popIn 0.3s ease' }}>
            {config.showAvatar && (
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: config.colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700 }}>
                {display.username[0]?.toUpperCase()}
              </div>
            )}
            <div>
              {config.showUsername && <div style={{ fontSize: config.fontSize * 0.7, color: config.colors.text }}>{display.username}</div>}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {config.showGiftName && <span style={{ fontSize: config.fontSize * 0.6, color: config.colors.accent }}>{display.giftName}</span>}
                {config.showCount && display.repeatCount > 1 && <span style={{ fontSize: config.fontSize * 0.5, color: config.colors.primary }}>×{display.repeatCount}</span>}
                {config.showDiamonds && <span style={{ fontSize: config.fontSize * 0.5, color: '#fbbf24' }}>💎 {display.diamonds}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: config.fontSize * 0.5 }}>Waiting for gifts...</div>
        )}
        {queue.length > 0 && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{queue.length} in queue</div>}
      </div>
    </BaseOverlay>
  );
}

export const GiftQueueComponent = memo(GiftQueueInner);
