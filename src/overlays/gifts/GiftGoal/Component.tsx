import React, { useState, useEffect, useCallback, memo } from 'react';
import type { GiftGoalConfig } from './types';
import type { OverlayEventSource, OverlayEvent } from '../../types';
import { BaseOverlay } from '../../base/BaseOverlay';

interface GiftGoalProps { config: GiftGoalConfig; mode: 'preview' | 'browser-source'; events?: OverlayEventSource; }

function GiftGoalInner({ config, mode, events }: GiftGoalProps): React.ReactElement {
  const [current, setCurrent] = useState(config.current);
  const [celebrated, setCelebrated] = useState(false);

  const progress = Math.min(current / config.target, 1);
  const percentage = Math.round(progress * 100);

  const handleEvent = useCallback((event: OverlayEvent) => {
    if (event.type === 'gift' && 'diamonds' in event) {
      const data = event as { type: 'gift'; diamonds: number };
      setCurrent(prev => {
        const next = prev + (data.diamonds || 1);
        if (next >= config.target && !celebrated && config.celebrateAtGoal) {
          setCelebrated(true);
        }
        return next;
      });
    }
  }, [config.target, config.celebrateAtGoal, celebrated]);

  useEffect(() => { if (!events) return; return events.subscribe(handleEvent); }, [events, handleEvent]);

  // Preview
  useEffect(() => {
    if (mode !== 'preview') return;
    const t = setTimeout(() => {
      setCurrent(Math.round(config.target * 0.7));
    }, 500);
    return () => clearTimeout(t);
  }, [mode, config.target]);

  const barBg = config.barStyle === 'gradient'
    ? `linear-gradient(90deg, ${config.barColor}, ${config.colors.accent})`
    : config.barStyle === 'striped'
    ? `repeating-linear-gradient(45deg, ${config.barColor}, ${config.barColor} 10px, ${config.barColor}99 10px, ${config.barColor}99 20px)`
    : config.barColor;

  return (
    <BaseOverlay config={config} mode={mode} instanceId="gift-goal" moduleId="gift-goal">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', justifyContent: 'center' }}>
        {config.showTarget && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: config.fontSize * 0.7, color: config.colors.text, opacity: 0.7 }}>
            <span>🎁 Gift Goal</span>
            {config.showCount && <span>{current} / {config.target}</span>}
          </div>
        )}
        <div style={{ width: '100%', height: config.barHeight, background: config.barBackgroundColor, borderRadius: config.border.radius, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            width: `${percentage}%`, height: '100%', background: barBg,
            borderRadius: config.border.radius, transition: 'width 0.5s ease-out',
            position: 'relative',
          }} />
        </div>
        {config.showPercentage && (
          <div style={{ fontSize: config.fontSize * 0.7, color: config.colors.text, textAlign: 'center', fontWeight: config.fontWeight }}>
            {percentage}%
          </div>
        )}
      </div>
    </BaseOverlay>
  );
}

export const GiftGoalComponent = memo(GiftGoalInner);
