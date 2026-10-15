// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RosaeFinity Event Bus V2 â€” Event Dispatcher
// v3.1 Architecture Spec (Frozen)
//
// Bridge between existing TikTok event system and
// the new Event Bus V2. Called from dispatchTikTokEvent().
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { getEventBus } from './OverlayEventBus';
import type { OverlayEvent, EventSourceType } from './EventTypes';

// â”€â”€â”€ TikTok Event â†’ OverlayEvent Converter â”€â”€â”€

const TIKTOK_TYPE_MAP: Record<string, string> = {
  gift: 'gift',
  follow: 'follow',
  like: 'like',
  share: 'share',
  comment: 'comment',
  subscribe: 'subscribe',
  join: 'join',
};

/**
 * Convert a raw TikTok event to an OverlayEvent.
 * Returns null if the event type is not recognized.
 */
export function toOverlayEvent(data: Record<string, unknown>): OverlayEvent | null {
  const rawType = (data.type as string) ?? '';
  const eventType = TIKTOK_TYPE_MAP[rawType] ?? rawType;

  if (!eventType) return null;

  const eventData: Record<string, unknown> = {
    username: data.user ?? data.nickname ?? 'unknown',
    nickname: data.nickname,
  };

  // Add type-specific data
  switch (rawType) {
    case 'gift':
      eventData.giftName = data.giftName ?? 'Unknown Gift';
      eventData.diamonds = data.diamondCount ?? 0;
      eventData.repeatCount = data.repeatCount ?? 1;
      // normalizedGiftDelta: already computed by the store dispatcher
      // in dispatchTikTokEvent (line 155: data.normalizedGiftDelta = effectiveDelta)
      // — pass through the store-computed delta directly.
      if (typeof data.normalizedGiftDelta === 'number') {
        eventData.normalizedGiftDelta = data.normalizedGiftDelta;
      }
      break;
    case 'like':
      eventData.count = data.likeCount ?? 1;
      eventData.totalLikes = data.totalLikeCount ?? 0;
      break;
    case 'comment':
      eventData.message = data.comment ?? '';
      break;
    case 'subscribe':
      eventData.username = data.user ?? data.nickname ?? 'unknown';
      break;
    case 'share':
    case 'join':
    case 'follow':
      // Already have username
      break;
  }

  return {
    id: `tiktok-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: eventType,
    source: 'tiktok',
    priority: rawType === 'gift' ? 1 : 0,
    timestamp: (data.timestamp as number) ?? Date.now(),
    data: eventData,
    ...(rawType === 'gift' ? {
      username: eventData.username as string,
      giftName: eventData.giftName as string,
      diamonds: eventData.diamonds as number,
      repeatCount: eventData.repeatCount as number,
      normalizedGiftDelta: data.normalizedGiftDelta as number | undefined,
      giftId: data.giftId as string | undefined,
      roomId: data.roomId as string | undefined,
      screenId: data.screenId as string | undefined,
    } : {}),
    screenId: (data.screenId as string) ?? undefined,
    cancelable: false,
  };
}

// â”€â”€â”€ Dispatch Bridge â”€â”€â”€

/**
 * Bridge function: called from existing dispatchTikTokEvent()
 * to forward events into Event Bus V2.
 *
 * This is the single integration point.
 */
export function dispatchToEventBus(data: Record<string, unknown>): void {
  const event = toOverlayEvent(data);
  if (event) {
    getEventBus().dispatch(event);
  }
}

// â”€â”€â”€ Direct Event Emission â”€â”€â”€

/**
 * Emit a custom event directly to the bus.
 */
export function emitEvent(
  type: string,
  data: Record<string, unknown>,
  options?: { source?: EventSourceType; priority?: 0 | 1 | 2; screenId?: string },
): string {
  return getEventBus().emit(type, data, options);
}

/**
 * Emit a test event for a specific overlay.
 */
export function emitTestEvent(
  overlayId: string,
  eventType: string,
  data?: Record<string, unknown>,
): string {
  return getEventBus().emit('test', {
    overlayId,
    eventType,
    ...data,
  }, { source: 'test' });
}
