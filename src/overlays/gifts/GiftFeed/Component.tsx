import React, { useState, useEffect, useCallback, memo } from 'react';
import type { GiftFeedConfig, GiftEntry } from './types';
import type { OverlayEventSource, OverlayEvent } from '../../types';
import { BaseOverlay } from '../../base/BaseOverlay';

interface GiftFeedProps {
  config: GiftFeedConfig;
  mode: 'preview' | 'browser-source';
  events?: OverlayEventSource;
}

function GiftFeedInner({ config, mode, events }: GiftFeedProps): React.ReactElement {
  const [gifts, setGifts] = useState<GiftEntry[]>([]);

  const handleEvent = useCallback((event: OverlayEvent) => {
    if (event.type === 'gift' && 'giftName' in event) {
      const data = event as { type: 'gift'; username: string; giftName: string; diamonds: number; repeatCount: number; timestamp: number };
      const entry: GiftEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        username: data.username,
        giftName: data.giftName,
        giftImage: '',
        count: data.repeatCount,
        diamonds: data.diamonds,
        timestamp: data.timestamp,
        isHighlight: data.diamonds >= config.highlightThreshold,
      };

      setGifts(prev => {
        const next = [entry, ...prev];
        return next.slice(0, config.maxItems);
      });
    }
  }, [config.maxItems, config.highlightThreshold]);

  useEffect(() => {
    if (!events) return;
    return events.subscribe(handleEvent);
  }, [events, handleEvent]);

  // Auto-remove
  useEffect(() => {
    if (config.autoRemoveMs <= 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setGifts(prev => prev.filter(g => now - g.timestamp < config.autoRemoveMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [config.autoRemoveMs]);

  // Preview test gift
  useEffect(() => {
    if (mode !== 'preview' || gifts.length > 0) return;
    const timer = setTimeout(() => {
      handleEvent({
        type: 'gift', id: 'test', source: 'test', priority: 0,
        timestamp: Date.now(), cancelable: false, data: {},
        username: 'TestUser', giftName: 'Rose', diamonds: 50, repeatCount: 1,
      } as OverlayEvent);
    }, 500);
    return () => clearTimeout(timer);
  }, [mode, gifts.length, handleEvent]);

  return (
    <BaseOverlay config={config} mode={mode} instanceId="gift-feed" moduleId="gift-feed">
      <div style={{ display: 'flex', flexDirection: 'column', gap: config.itemGap, overflow: 'hidden', height: '100%' }}>
        {gifts.map((gift, i) => (
          <div
            key={gift.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: config.border.radius,
              background: gift.isHighlight ? `${config.highlightColor}20` : 'rgba(255,255,255,0.05)',
              border: gift.isHighlight ? `1px solid ${config.highlightColor}40` : '1px solid transparent',
              animation: `slideUp 0.3s ease-out ${i * 0.05}s both`,
            }}
          >
            {config.showAvatar && (
              <div style={{
                width: config.avatarSize, height: config.avatarSize, borderRadius: '50%',
                background: config.colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: config.avatarSize * 0.4, color: '#fff', flexShrink: 0,
              }}>
                {gift.username[0]?.toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {config.showUsername && (
                <div style={{ fontSize: config.fontSize, fontWeight: config.fontWeight, color: config.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {gift.username}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {config.showGiftImage && gift.giftImage && (
                  <img src={gift.giftImage} alt="" style={{ width: 16, height: 16 }} />
                )}
                {config.showGiftName && (
                  <span style={{ fontSize: config.fontSize - 1, color: config.colors.accent }}>{gift.giftName}</span>
                )}
                {config.showCount && gift.count > 1 && (
                  <span style={{ fontSize: config.fontSize - 2, color: config.colors.primary, fontWeight: 700 }}>×{gift.count}</span>
                )}
              </div>
            </div>
            {config.showTimestamp && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                {new Date(gift.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        ))}
      </div>
    </BaseOverlay>
  );
}

export const GiftFeedComponent = memo(GiftFeedInner);
