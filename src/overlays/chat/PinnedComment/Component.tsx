import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import type { PinnedCommentConfig } from './types';
import type { OverlayEventSource, OverlayEvent } from '../../types';
import { BaseOverlay } from '../../base/BaseOverlay';

interface PinnedCommentProps { config: PinnedCommentConfig; mode: 'preview' | 'browser-source'; events?: OverlayEventSource; }

interface PinnedData { username: string; message: string; timestamp: number; }

function PinnedCommentInner({ config, mode, events }: PinnedCommentProps): React.ReactElement {
  const [pinned, setPinned] = useState<PinnedData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pinComment = useCallback((username: string, message: string) => {
    setPinned({ username, message, timestamp: Date.now() });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPinned(null), config.timeout * 1000);
  }, [config.timeout]);

  const handleEvent = useCallback((event: OverlayEvent) => {
    if (event.type !== 'comment' || !('message' in event)) return;
    const data = event as { type: 'comment'; username: string; message: string; timestamp: number };

    // Check age
    if (Date.now() - data.timestamp > config.maxAge * 1000) return;

    switch (config.pinMode) {
      case 'latest':
        pinComment(data.username, data.message);
        break;
      case 'keyword':
        if (config.keyword && data.message.toLowerCase().includes(config.keyword.toLowerCase())) {
          pinComment(data.username, data.message);
        }
        break;
      case 'moderator':
        // Would need moderator flag from event data
        pinComment(data.username, data.message);
        break;
      case 'manual':
        // Only triggered externally
        break;
    }
  }, [config.pinMode, config.keyword, config.maxAge, pinComment]);

  useEffect(() => { if (!events) return; return events.subscribe(handleEvent); }, [events, handleEvent]);

  // Preview
  useEffect(() => {
    if (mode !== 'preview' || pinned) return;
    const t = setTimeout(() => {
      pinComment('ModUser', 'This is a pinned message! 📌');
    }, 1000);
    return () => clearTimeout(t);
  }, [mode, pinned, pinComment]);

  if (!pinned) return <BaseOverlay config={{ ...config, opacity: 0 } as any} mode={mode} instanceId="pinned-comment" moduleId="pinned-comment"><div /></BaseOverlay>;

  return (
    <BaseOverlay config={config} mode={mode} instanceId="pinned-comment" moduleId="pinned-comment">
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        background: config.colors.background, borderRadius: config.border.radius,
        border: config.highlightBorder ? `${config.borderWidth}px solid ${config.borderColor}` : 'none',
        animation: 'slideDown 0.3s ease-out',
        width: '100%',
      }}>
        <div style={{ fontSize: 18 }}>📌</div>
        {config.showAvatar && (
          <div style={{
            width: config.avatarSize, height: config.avatarSize, borderRadius: '50%',
            background: config.colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: config.avatarSize * 0.4, color: '#fff', flexShrink: 0,
          }}>
            {pinned.username[0]?.toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: config.fontSize * 0.75, color: config.usernameColor, fontWeight: 700 }}>
            {pinned.username}
            {config.showBadges && <span style={{ marginLeft: 4, color: config.borderColor }}>🛡</span>}
          </div>
          <div style={{ fontSize: config.fontSize, color: config.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pinned.message}
          </div>
        </div>
        {config.showTimestamp && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            {new Date(pinned.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </BaseOverlay>
  );
}

export const PinnedCommentComponent = memo(PinnedCommentInner);
