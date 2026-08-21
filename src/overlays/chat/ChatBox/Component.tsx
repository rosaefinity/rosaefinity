import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import type { ChatBoxConfig, ChatMessage } from './types';
import type { OverlayEventSource, OverlayEvent } from '../../types';
import { BaseOverlay } from '../../base/BaseOverlay';

interface ChatBoxProps { config: ChatBoxConfig; mode: 'preview' | 'browser-source'; events?: OverlayEventSource; }

function ChatBoxInner({ config, mode, events }: ChatBoxProps): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seenMessages = useRef(new Set<string>());

  const handleEvent = useCallback((event: OverlayEvent) => {
    if (event.type === 'comment' && 'message' in event) {
      const data = event as { type: 'comment'; username: string; message: string; timestamp: number };
      const msgText = data.message.toLowerCase();

      // Profanity filter (basic)
      if (config.profanityFilter && /\b(badword)\b/i.test(data.message)) return;

      // Duplicate filter
      const dedupeKey = `${data.username}:${data.message}`;
      if (config.duplicateFilter && seenMessages.current.has(dedupeKey)) return;
      seenMessages.current.add(dedupeKey);
      if (seenMessages.current.size > 200) {
        const first = seenMessages.current.values().next().value;
        if (first) seenMessages.current.delete(first);
      }

      const isHighlighted = config.highlightKeywords.some(kw => msgText.includes(kw.toLowerCase()));

      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        username: data.username, message: data.message, timestamp: data.timestamp,
        isModerator: false, isSubscriber: false, isGift: false,
        isHighlighted, badgeColor: config.badgeColors.moderator,
      };

      setMessages(prev => {
        const next = config.reverseMode ? [...prev, msg] : [msg, ...prev];
        return next.slice(0, config.maxMessages);
      });
    }
  }, [config.maxMessages, config.profanityFilter, config.duplicateFilter, config.highlightKeywords, config.reverseMode, config.badgeColors]);

  useEffect(() => { if (!events) return; return events.subscribe(handleEvent); }, [events, handleEvent]);

  // Auto-scroll
  useEffect(() => {
    if (!config.autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, config.autoScroll]);

  // Preview test messages
  useEffect(() => {
    if (mode !== 'preview' || messages.length > 0) return;
    const testMsgs = [
      { username: 'Streamer', message: 'Welcome to the stream! 🎉', timestamp: Date.now() },
      { username: 'Fan123', message: 'Love the content!', timestamp: Date.now() + 100 },
      { username: 'ModUser', message: 'Chat rules: be nice', timestamp: Date.now() + 200 },
    ];
    testMsgs.forEach((m, i) => {
      setTimeout(() => {
        handleEvent({ type: 'comment', id: `t${i}`, source: 'test', priority: 0, timestamp: m.timestamp, cancelable: false, data: {}, ...m } as OverlayEvent);
      }, 500 + i * 400);
    });
  }, [mode, messages.length, handleEvent]);

  const getTextStyle = () => ({
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    fontWeight: config.fontWeight,
    color: config.messageColor,
    textShadow: config.shadowEnabled ? `0 0 ${config.shadowBlur}px ${config.shadowColor}` : 'none',
    WebkitTextStroke: config.outlineEnabled ? `${config.outlineWidth}px ${config.outlineColor}` : 'none',
  });

  return (
    <BaseOverlay config={config} mode={mode} instanceId="chat-box" moduleId="chat-box">
      <div ref={scrollRef} style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: config.messageGap }}>
        {[...messages].reverse().map((msg, i) => (
          <div key={msg.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: config.messageStyle === 'bubble' ? '6px 10px' : '2px 0',
            borderRadius: config.messageStyle === 'bubble' ? config.border.radius : 0,
            background: config.messageStyle === 'bubble'
              ? msg.isHighlighted ? `${config.highlightColor}15` : 'rgba(255,255,255,0.05)'
              : 'transparent',
            animation: `slideInLeft 0.3s ease-out`,
            opacity: config.fadeOldMessages ? Math.max(0.4, 1 - i * 0.05) : 1,
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
            <div style={{ flex: 1, minWidth: 0 }}>
              {config.showUsername && (
                <span style={{ ...getTextStyle(), color: msg.isHighlighted ? config.highlightColor : config.usernameColor, fontWeight: 700, marginRight: 6 }}>
                  {config.showBadges && msg.isModerator && <span style={{ color: config.badgeColors.moderator, marginRight: 4 }}>🛡</span>}
                  {config.showBadges && msg.isSubscriber && <span style={{ color: config.badgeColors.subscriber, marginRight: 4 }}>⭐</span>}
                  {msg.username}
                </span>
              )}
              <span style={getTextStyle()}>{msg.message}</span>
              {config.showTimestamp && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </BaseOverlay>
  );
}

export const ChatBoxComponent = memo(ChatBoxInner);
