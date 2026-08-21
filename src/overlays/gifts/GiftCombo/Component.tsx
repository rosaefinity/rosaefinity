import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import type { GiftComboConfig } from './types';
import type { OverlayEventSource, OverlayEvent } from '../../types';
import { BaseOverlay } from '../../base/BaseOverlay';

interface GiftComboProps { config: GiftComboConfig; mode: 'preview' | 'browser-source'; events?: OverlayEventSource; }

function GiftComboInner({ config, mode, events }: GiftComboProps): React.ReactElement {
  const [count, setCount] = useState(0);
  const [username, setUsername] = useState('');
  const [giftName, setGiftName] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCombo = useCallback(() => {
    setActive(false);
    setCount(0);
    setTimeLeft(0);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (comboTimerRef.current) { clearTimeout(comboTimerRef.current); comboTimerRef.current = null; }
  }, []);

  const handleEvent = useCallback((event: OverlayEvent) => {
    if (event.type === 'gift' && 'giftName' in event) {
      const data = event as { type: 'gift'; username: string; giftName: string; diamonds: number; timestamp: number };
      setUsername(data.username);
      setGiftName(data.giftName);
      setCount(prev => prev + 1);
      setActive(true);
      setTimeLeft(config.comboTimeout);

      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(resetCombo, config.comboTimeout * 1000);
    }
  }, [config.comboTimeout, resetCombo]);

  useEffect(() => {
    if (!active || !config.showTimer) return;
    timerRef.current = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [active, config.showTimer]);

  useEffect(() => { if (!events) return; return events.subscribe(handleEvent); }, [events, handleEvent]);

  useEffect(() => {
    if (mode !== 'preview' || active) return;
    const t = setTimeout(() => {
      handleEvent({ type: 'gift', id: 't1', source: 'test', priority: 0, timestamp: Date.now(), cancelable: false, data: {}, username: 'User1', giftName: 'Rose', diamonds: 10, repeatCount: 1 } as OverlayEvent);
      setTimeout(() => handleEvent({ type: 'gift', id: 't2', source: 'test', priority: 0, timestamp: Date.now(), cancelable: false, data: {}, username: 'User1', giftName: 'Rose', diamonds: 10, repeatCount: 1 } as OverlayEvent), 300);
      setTimeout(() => handleEvent({ type: 'gift', id: 't3', source: 'test', priority: 0, timestamp: Date.now(), cancelable: false, data: {}, username: 'User1', giftName: 'Rose', diamonds: 10, repeatCount: 1 } as OverlayEvent), 600);
    }, 1000);
    return () => clearTimeout(t);
  }, [mode, active, handleEvent]);

  if (!active) return <BaseOverlay config={{ ...config, opacity: 0 } as any} mode={mode} instanceId="gift-combo" moduleId="gift-combo"><div /></BaseOverlay>;

  return (
    <BaseOverlay config={config} mode={mode} instanceId="gift-combo" moduleId="gift-combo">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
        {config.showUsername && <div style={{ fontSize: config.fontSize * 0.5, color: config.colors.text, opacity: 0.7 }}>{username}</div>}
        <div style={{ fontSize: config.fontSize, fontWeight: config.fontWeight, color: config.colors.primary, animation: 'comboPulse 0.3s ease' }}>
          {count} COMBO
        </div>
        {config.showGiftName && <div style={{ fontSize: config.fontSize * 0.4, color: config.colors.accent }}>{giftName}</div>}
        {config.showTimer && timeLeft > 0 && (
          <div style={{ fontSize: config.fontSize * 0.35, color: 'rgba(255,255,255,0.5)' }}>{timeLeft}s</div>
        )}
      </div>
    </BaseOverlay>
  );
}

export const GiftComboComponent = memo(GiftComboInner);
