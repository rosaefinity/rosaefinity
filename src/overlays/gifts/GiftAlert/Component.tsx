import React, { useState, useEffect, useCallback, memo } from 'react';
import type { GiftAlertConfig } from './types';
import type { OverlayEventSource, OverlayEvent } from '../../types';
import { BaseOverlay } from '../../base/BaseOverlay';

interface GiftAlertProps {
  config: GiftAlertConfig;
  mode: 'preview' | 'browser-source';
  events?: OverlayEventSource;
}

interface AlertData {
  username: string;
  giftName: string;
  diamonds: number;
  repeatCount: number;
  timestamp: number;
}

function GiftAlertInner({ config, mode, events }: GiftAlertProps): React.ReactElement {
  const [alert, setAlert] = useState<AlertData | null>(null);
  const [visible, setVisible] = useState(false);

  const handleEvent = useCallback((event: OverlayEvent) => {
    if (event.type === 'gift' && 'giftName' in event) {
      const data = event as { type: 'gift'; username: string; giftName: string; diamonds: number; repeatCount: number; timestamp: number };
      setAlert({ username: data.username, giftName: data.giftName, diamonds: data.diamonds, repeatCount: data.repeatCount, timestamp: data.timestamp });
      setVisible(true);

      // Play sound
      if (config.soundEnabled && config.soundUrl) {
        try { const audio = new Audio(config.soundUrl); audio.volume = config.soundVolume / 100; audio.play().catch(() => {}); } catch {}
      }

      // Auto-hide
      setTimeout(() => setVisible(false), config.duration * 1000);
    }
  }, [config.duration, config.soundEnabled, config.soundUrl, config.soundVolume]);

  useEffect(() => {
    if (!events) return;
    return events.subscribe(handleEvent);
  }, [events, handleEvent]);

  // Preview test
  useEffect(() => {
    if (mode !== 'preview' || visible) return;
    const timer = setTimeout(() => {
      handleEvent({
        type: 'gift', id: 'test', source: 'test', priority: 0,
        timestamp: Date.now(), cancelable: false, data: {},
        username: 'TestUser', giftName: 'Rose', diamonds: 50, repeatCount: 3,
      } as OverlayEvent);
    }, 1000);
    return () => clearTimeout(timer);
  }, [mode, visible, handleEvent]);

  if (!visible || !alert) return <BaseOverlay config={{ ...config, opacity: 0 } as any} mode={mode} instanceId="gift-alert" moduleId="gift-alert"><div /></BaseOverlay>;

  return (
    <BaseOverlay config={config} mode={mode} instanceId="gift-alert" moduleId="gift-alert">
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
        background: config.colors.background, borderRadius: config.border.radius,
        animation: `popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`,
        width: config.alertStyle === 'banner' ? '100%' : 'auto',
        maxWidth: config.alertStyle === 'toast' ? '400px' : '100%',
      }}>
        {config.showAvatar && (
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: config.colors.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: '#fff', flexShrink: 0,
          }}>
            {alert.username[0]?.toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1 }}>
          {config.showUsername && (
            <div style={{ fontSize: config.fontSize, fontWeight: config.fontWeight, color: config.colors.text }}>
              {alert.username}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {config.showGiftName && (
              <span style={{ fontSize: config.fontSize - 2, color: config.colors.accent }}>sent {alert.giftName}</span>
            )}
            {config.showDiamonds && (
              <span style={{ fontSize: config.fontSize - 2, color: config.colors.primary, fontWeight: 700 }}>
                💎 {alert.diamonds}
              </span>
            )}
            {config.showCombo && alert.repeatCount > 1 && (
              <span style={{ fontSize: config.fontSize - 2, color: config.colors.accent, fontWeight: 700 }}>
                ×{alert.repeatCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </BaseOverlay>
  );
}

export const GiftAlertComponent = memo(GiftAlertInner);