import React, { useEffect, useState } from 'react';
import type { RendererProps, OverlayEvent } from '../types';

/**
 * Gift Alert Renderer
 * Renders animated gift alerts for TikTok LIVE gift events
 */
export const GiftAlertRenderer: React.FC<RendererProps<any>> = ({
  config,
  mode = 'preview',
  events,
  size,
}) => {
  const [visible, setVisible] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<OverlayEvent | null>(null);
  const [animating, setAnimating] = useState(false);

  // Subscribe to events when in browser-source mode or preview
  useEffect(() => {
    if (!events) return;

    const unsubscribe = events.subscribe((event: OverlayEvent) => {
      // Only handle gift events
      if (event.type === 'gift') {
        // [OVERLAY-EVENT-FLOW] GiftAlertRenderer received gift event
        console.log('[OVERLAY-EVENT-FLOW] GiftAlertRenderer:', JSON.stringify({
          giftName: (event as any).giftName,
          giftId: (event as any).giftId,
          diamondCount: (event as any).diamondCount,
          user: (event as any).user,
        }));
        setCurrentEvent(event);
        setVisible(true);
        setAnimating(true);

        // Auto-hide after duration
        const duration = (config.animation?.duration ?? 500) + 3000;
        setTimeout(() => {
          setAnimating(false);
          setTimeout(() => {
            setVisible(false);
            setCurrentEvent(null);
          }, config.animation?.duration ?? 500);
        }, duration);
      }
    });

    return unsubscribe;
  }, [events, config.animation?.duration]);

  // Preview mode: simulate a gift event for demonstration
  useEffect(() => {
    if (mode !== 'preview') return;

    const timer = setTimeout(() => {
      const previewEvent: OverlayEvent = {
        type: 'gift',
        username: 'PreviewUser',
        giftName: 'Rose',
        diamonds: 1,
      };
      setCurrentEvent(previewEvent);
      setVisible(true);
      setAnimating(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [mode]);

  if (!visible || !currentEvent) return null;

  const c = config as any;
  const layout = c.layout ?? {};
  const color = c.color ?? {};
  const animation = c.animation ?? {};
  const font = c.font ?? {};
  const appearance = c.appearance ?? {};

  // Position styles based on layout config
  const positionStyles: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...getPositionStyles(layout.position ?? 'bottom-center'),
  };

  // Card styles
  const cardStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: `${appearance.padding ?? 12}px ${appearance.padding ?? 18}px`,
    borderRadius: `${appearance.borderRadius ?? 12}px`,
    background: appearance.background,
    border: appearance.border,
    boxShadow: appearance.boxShadow,
    opacity: appearance.opacity,
    maxWidth: `${layout.maxWidth ?? 420}px`,
    transform: animating ? 'translateX(0)' : 'translateX(-40px)',
    opacity: animating ? 1 : 0,
    transition: `transform ${animation.duration ?? 500}ms ${animation.easing ?? 'cubic-bezier(0.34, 1.56, 0.64, 1)'}, opacity ${animation.duration ?? 500}ms ${animation.easing ?? 'cubic-bezier(0.34, 1.56, 0.64, 1)'}`,
    fontFamily: font.fontFamily,
    fontSize: `${font.fontSize}px`,
    fontWeight: font.fontWeight,
    lineHeight: font.lineHeight,
    color: color.text,
  };

  // Gift icon URL
  const giftIconUrl = c.customGiftIcons?.[currentEvent.giftName] ?? c.defaultGiftIcon ?? '🎁';

  return (
    <div style={positionStyles}>
      <div style={cardStyles} className={`alert-card alert-gift`}>
        {/* Gift Icon */}
        {c.showGiftIcon && (
          <div
            style={{
              fontSize: `${c.giftIconSize ?? 48}px`,
              flexShrink: 0,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
            }}
            className="alert-icon"
          >
            {isEmoji(giftIconUrl) ? giftIconUrl : <img src={giftIconUrl} alt="" style={{ width: c.giftIconSize ?? 48, height: c.giftIconSize ?? 48 }} />}
          </div>
        )}

        {/* Alert Content */}
        <div style={{ flex: 1, minWidth: 0 }} className="alert-body">
          {/* Title */}
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.7, letterSpacing: '0.06em', marginBottom: 2 }} className="alert-title">
            Gift
          </div>

          {/* Username */}
          {c.showUsername && (
            <div style={{ fontSize: '15px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} className="alert-user">
              @{currentEvent.username}
            </div>
          )}

          {/* Gift Name */}
          {c.showGiftName && (
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} className="alert-detail">
              {currentEvent.giftName}
            </div>
          )}

          {/* Quantity */}
          {c.showQuantity && currentEvent.repeatCount && currentEvent.repeatCount > 1 && (
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: 2 }} className="alert-detail">
              ×{currentEvent.repeatCount}
            </div>
          )}

          {/* Diamond Count */}
          {c.showDiamondCount && currentEvent.diamonds && (
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: 2 }} className="alert-detail">
              {currentEvent.diamonds} diamonds
            </div>
          )}
        </div>

        {/* Badge - Quantity */}
        {c.showQuantity && currentEvent.repeatCount && currentEvent.repeatCount > 1 && (
          <div style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            padding: '4px 12px',
            fontSize: '14px',
            fontWeight: 700,
            flexShrink: 0,
          }} className="alert-badge">
            ×{currentEvent.repeatCount}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Get position styles based on layout position
 */
function getPositionStyles(position: string): React.CSSProperties {
  const base = { left: 0, right: 0, top: 0, bottom: 0 };

  switch (position) {
    case 'top-left':
      return { ...base, top: 20, left: 20, alignItems: 'flex-start' };
    case 'top-center':
      return { ...base, top: 20, left: 0, right: 0, justifyContent: 'center' };
    case 'top-right':
      return { ...base, top: 20, right: 20, alignItems: 'flex-end' };
    case 'center':
      return { ...base, top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center' };
    case 'bottom-left':
      return { ...base, bottom: 20, left: 20, alignItems: 'flex-start' };
    case 'bottom-center':
      return { ...base, bottom: 20, left: 0, right: 0, justifyContent: 'center', flexDirection: 'column-reverse' };
    case 'bottom-right':
      return { ...base, bottom: 20, right: 20, alignItems: 'flex-end', flexDirection: 'column-reverse' };
    default:
      return { ...base, bottom: 20, left: 0, right: 0, justifyContent: 'center', flexDirection: 'column-reverse' };
  }
}

/**
 * Check if a string is an emoji (simple heuristic)
 */
function isEmoji(str: string): boolean {
  // Simple check - if it's a single character or common emoji pattern
  return str.length <= 2 && /[\u{1F300}-\u{1FAFF}]/u.test(str);
}

export default GiftAlertRenderer;