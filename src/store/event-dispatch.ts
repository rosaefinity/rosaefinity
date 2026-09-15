import { useAppStore } from "./app-store";
import { sendToOverlay } from "../lib/overlay-bus";
import { getActionMedia } from "../lib/db";
import { dispatchToEventBus } from "../events/EventDispatcher";
import { api, safeInvoke } from "../services/electron-service";
import { normalizeScreen, getNormalizedActionScreen, logScreenTrace } from "../lib/screen-normalizer";
import { enqueueAction, notifyActionComplete, peekNextQueued } from "../lib/action-queue";
import { useCoinJarStore, isDuplicateGift } from "./coin-jar-store";
import type { Action, Event, LiveEvent, ScreenId } from "../types";
import { getGiftsSync, getGiftImageUrl } from "../services/gift-service";
import { trackGoalEvent, trackGoalOverlayEvents } from "../goals/goal-tracker";

const globalCooldowns: Map<string, number> = new Map();
const userCooldowns: Map<string, Map<string, number>> = new Map();

// ── RepeatCount delta tracking for coin-jar ──
// TikTok's repeatCount is CUMULATIVE (total seen), not per-event delta.
// Track per-gift cumulative repeatCount to calculate the true delta.
const lastGiftRepeatCount = new Map<string, number>();

// Bounded cooldown maps — clear entries older than 1 hour to prevent unbounded growth
const COOLDOWN_MAX_AGE_MS = 60 * 60 * 1000;
let lastCleanupMs = 0;

function cleanupStaleCooldowns(): void {
  const now = Date.now();
  if (now - lastCleanupMs < 5 * 60 * 1000) return; // max once per 5 min
  lastCleanupMs = now;
  for (const [actionId, timestamp] of globalCooldowns) {
    if (now - timestamp > COOLDOWN_MAX_AGE_MS) globalCooldowns.delete(actionId);
  }
  for (const [actionId, userMap] of userCooldowns) {
    for (const [user, timestamp] of userMap) {
      if (now - timestamp > COOLDOWN_MAX_AGE_MS) userMap.delete(user);
    }
    if (userMap.size === 0) userCooldowns.delete(actionId);
  }
}

export function dispatchTikTokEvent(data: any) {
  if (!data) return;

  console.log('[EVENT-RECEIVED]', {
    type: data.type,
    screenId: data.screenId,
    giftName: data.giftName,
    giftId: data.giftId,
    repeatCount: data.repeatCount,
    diamondCount: data.diamondCount,
    user: data.user,
  });

  // ── Coin Jar: accumulate gift coins (independent of alerts/actions) ──
  if (data.type === "gift") {
    // [REAL-GIFT-DEBUG][DISPATCH-INPUT] Gift event reached dispatch
    console.log('[REAL-GIFT-DEBUG][DISPATCH-INPUT]', JSON.stringify({
      type: data.type,
      screenId: data.screenId,
      giftId: data.giftId || '(empty)',
      giftName: data.giftName || '(empty)',
      repeatCount: data.repeatCount || 1,
      diamondCount: data.diamondCount || 0,
      giftImageUrl: data.giftImageUrl || '(empty)',
    }));
    const giftId = data.giftId || '';
    const userId = data.user || 'unknown';
    const repeatCount = data.repeatCount || 1;
    const diamondCount = data.diamondCount || 0;
    const coinValue = diamondCount * repeatCount;
    const timestamp = data.timestamp || Date.now();
    let rawImageUrl = data.giftImageUrl || '';
    let imageSource: 'native-tiktok' | 'catalog-fallback' | 'empty' = rawImageUrl ? 'native-tiktok' : 'empty';
    // Resolve image URL from catalog if native URL is empty
    if (!rawImageUrl && (data.giftName || data.giftId)) {
      const catalog = getGiftsSync();
      if (catalog) {
        const entry = data.giftId
          ? catalog.find(g => g.giftId === data.giftId)
          : catalog.find(g => g.name.toLowerCase().trim() === (data.giftName || '').toLowerCase().trim());
        if (entry) {
          rawImageUrl = getGiftImageUrl(entry);
          if (rawImageUrl) imageSource = 'catalog-fallback';
        }
      }
    }
    const source = data._source || 'unknown';

    // [COIN-JAR-GIFT-TRACE][DISPATCH] Image URL resolution audit
    console.log('[COIN-JAR-GIFT-TRACE][DISPATCH]', JSON.stringify({
      screenId: data.screenId,
      giftId: data.giftId || '(empty)',
      giftName: data.giftName || '(empty)',
      diamondCount: data.diamondCount || 0,
      repeatCount: data.repeatCount || 1,
      incomingGiftImageUrl: data.giftImageUrl || '(empty)',
      resolvedGiftImageUrl: rawImageUrl || '(empty)',
      imageSource,
    }));

    // CorrelationId: giftId-userId-timestamp (matches tiktok-service format)
    const cid = `${giftId || 'none'}-${userId}-${timestamp}`;

    console.log('[COIN-JAR-REAL-LIVE][DISPATCH]', JSON.stringify({
      giftId, giftName: data.giftName, giftImageUrl: rawImageUrl || '(empty)',
    }));

    // NORMALIZED stage
    console.log(`[COIN-JAR-LIVE][${cid}] NORMALIZED`, JSON.stringify({
      correlationId: cid, source, giftId, giftName: data.giftName,
      diamondCount, repeatCount, coinValue, screenId: data.screenId,
    }));

    // COIN_CALCULATED stage
    const prevAmount = useCoinJarStore.getState().currentAmount || 0;
    console.log(`[COIN-JAR-LIVE][${cid}] COIN_CALCULATED`, JSON.stringify({
      correlationId: cid, source, giftId, giftName: data.giftName,
      diamondCount, repeatCount, calculatedCoinValue: coinValue,
      previousAmount: prevAmount, newAmount: prevAmount + coinValue,
    }));

    // ── Delta calculation for coin counter ──
    // TikTok's repeatCount is CUMULATIVE (total seen), not per-event delta.
    // Only charge coins for NEW gifts (delta), not the full cumulative count.
    const giftTrackKey = `${giftId}:${userId}`;
    const prevRepeatCountForCoins = lastGiftRepeatCount.get(giftTrackKey) || 0;
    const deltaRepeatCount = Math.max(0, repeatCount - prevRepeatCountForCoins);
    lastGiftRepeatCount.set(giftTrackKey, repeatCount);

    // Evict stale entries
    if (lastGiftRepeatCount.size > 200) {
      const keys = Array.from(lastGiftRepeatCount.keys());
      for (let i = 0; i < keys.length - 100; i++) {
        lastGiftRepeatCount.delete(keys[i]);
      }
    }

    // If delta=0 but this is a valid gift event, use at least 1 (handles per-event repeatCount)
    const effectiveDelta = deltaRepeatCount > 0 ? deltaRepeatCount : 1;

    // Coin value uses effectiveDelta (at least 1 per event)
    const deltaCoinValue = diamondCount * effectiveDelta;

    // Combo safety
    const isDuplicate = isDuplicateGift(giftId, userId, repeatCount, timestamp);
    if (repeatCount > 1) {
      console.log(`[COIN-JAR-LIVE][${cid}] COMBO_RESULT`, JSON.stringify({
        correlationId: cid, source, giftId, giftName: data.giftName,
        diamondCount, repeatCount, prevRepeatCountForCoins, deltaRepeatCount,
        calculatedCoinValue: coinValue,
        deltaCoinValue,
        visibleCascadeCount: Math.min(deltaRepeatCount, 5),
        duplicateRejected: isDuplicate,
      }));
    }

    if (deltaCoinValue > 0 && !isDuplicate) {
      // STORE_UPDATED + SSE_BROADCAST — use delta, not cumulative
      useCoinJarStore.getState().addGiftAmount(deltaCoinValue, data.giftName, giftId, rawImageUrl);
      console.log(`[COIN-JAR-LIVE][${cid}] STORE_UPDATED`, JSON.stringify({
        correlationId: cid, source, giftId, giftName: data.giftName,
        coinValue: deltaCoinValue, deltaRepeatCount, prevRepeatCountForCoins,
      }));
    } else {
      console.log(`[COIN-JAR-LIVE][${cid}] SKIPPED`, JSON.stringify({
        correlationId: cid, source, reason: isDuplicate ? 'duplicate' : 'zero-value',
      }));
    }
  }

  // ── Goal tracking (independent from Screen 1-8) ──
  trackGoalEvent(data);
  // Instance-based goal tracking for new goal-likes/followers/gifts modules
  trackGoalOverlayEvents(data);

  cleanupStaleCooldowns();
  const store = useAppStore.getState();
  const { events, actions, alertsMasterEnabled, alertSettings } = store;

  if (!alertsMasterEnabled) return;

  // Per-type alert toggle check
  const typeSettings = alertSettings[data.type as keyof typeof alertSettings];
  if (typeSettings && typeof typeSettings === "object" && "enabled" in typeSettings && !typeSettings.enabled) return;

  const screenId: ScreenId = data.screenId || "screen-0";

  const liveEvent: LiveEvent = {
    type: data.type,
    screenId,
    user: data.user,
    nickname: data.nickname,
    giftName: data.giftName,
    repeatCount: data.repeatCount,
    diamondCount: data.diamondCount,
    giftImageUrl: data.giftImageUrl,
    giftId: data.giftId,
    comment: data.comment,
    likeCount: data.likeCount,
    totalLikeCount: data.totalLikeCount,
    timestamp: data.timestamp || Date.now(),
  };
  store.addScreenLiveEvent(screenId, liveEvent);

  // Update per-screen stats
  switch (data.type) {
    case "gift": store.incrementScreenStat(screenId, "gifts"); break;
    case "like": store.incrementScreenStat(screenId, "likes"); break;
    case "follow": store.incrementScreenStat(screenId, "follows"); break;
    case "subscribe": store.incrementScreenStat(screenId, "follows"); break;
    case "join": {
      const views = store.screenConnections[screenId]?.stats.views || 0;
      store.setScreenStats(screenId, { views: views + 1 });
      break;
    }
  }

  // Find matching events and execute actions
  console.log('[EVENT-MATCHING]', {
    incomingType: data.type,
    incomingGiftName: data.giftName,
    incomingGiftId: data.giftId,
    incomingDiamondCount: data.diamondCount,
    incomingUser: data.user,
    enabledEventCount: events.filter(e => e.enabled).length,
    totalEventCount: events.length,
  });

  // STEP 6 DIAGNOSTIC: Log every enabled event's config for comparison
  const enabledEvents = events.filter(e => e.enabled);
  console.log('[EVENT-CONFIG-CHECK]', JSON.stringify({
    incomingGiftName: data.giftName,
    incomingGiftId: data.giftId,
    incomingDiamondCount: data.diamondCount,
    totalEvents: events.length,
    enabledEvents: enabledEvents.length,
    events: enabledEvents.map(e => ({
      id: e.id,
      actionName: e.actionName,
      triggerType: e.triggerType,
      giftName: e.giftName,
      minCoins: e.minCoins,
      keyword: e.keyword,
    })),
  }));

  const matchingEvents = events.filter(e => e.enabled && matchesTrigger(e, data));

  // STEP 6 DIAGNOSTIC: Log why each enabled event matched or failed
  // Only log when the trigger type is compatible with the incoming event type
  const giftOnlyTypes = new Set(['gift', 'specificgift', 'giftcoins']);
  for (const evt of enabledEvents) {
    // Skip logging for trigger types that can't possibly match this incoming event type
    const isGiftTrigger = giftOnlyTypes.has(evt.triggerType);
    const isGiftEvent = data.type === 'gift';
    if (isGiftTrigger !== isGiftEvent) continue; // skip non-relevant comparisons

    const matched = matchesTrigger(evt, data);
    let reason = '';
    switch (evt.triggerType) {
      case 'gift':
        reason = matched ? `type="${data.type}" === "gift"` : `type="${data.type}" !== "gift"`;
        break;
      case 'specificgift':
        reason = matched
          ? `giftName "${data.giftName?.toLowerCase()}" === "${evt.giftName?.toLowerCase()}"`
          : `giftName "${data.giftName?.toLowerCase()}" !== "${evt.giftName?.toLowerCase()}" (type=${data.type})`;
        break;
      case 'giftcoins':
        reason = matched
          ? `diamondCount ${data.diamondCount || 0} >= minCoins ${evt.minCoins || 0}`
          : `diamondCount ${data.diamondCount || 0} < minCoins ${evt.minCoins || 0} (type=${data.type})`;
        break;
      case 'follow':
        reason = matched ? `type="follow"` : `type="${data.type}" !== "follow"`;
        break;
      case 'like':
        reason = matched ? `type="like"` : `type="${data.type}" !== "like"`;
        break;
      case 'comment':
        reason = matched
          ? `keyword "${evt.keyword}" found in "${data.comment}"`
          : `keyword "${evt.keyword}" NOT in "${data.comment || ''}" (type=${data.type})`;
        break;
      case 'subscribe':
        reason = matched ? `type="subscribe"` : `type="${data.type}" !== "subscribe"`;
        break;
      default:
        reason = `triggerType="${evt.triggerType}"`;
    }
    console.log('[EVENT-MATCH-DETAIL]', JSON.stringify({
      eventId: evt.id,
      eventName: evt.actionName,
      triggerType: evt.triggerType,
      matched,
      reason,
      expectedGiftName: evt.giftName,
      receivedGiftName: data.giftName,
      expectedGiftId: evt.giftId,
      receivedGiftId: data.giftId,
    }));
  }

  console.log('[EVENT-MATCH-RESULT]', {
    matchedCount: matchingEvents.length,
    matchedEvents: matchingEvents.map(e => ({
      eventId: e.id,
      eventName: e.actionName,
      triggerType: e.triggerType,
      giftName: e.giftName,
      linkedActionId: actions.find(a => a.name === e.actionName)?.id,
    })),
  });
  for (const evt of matchingEvents) {
    console.log('[EVENT-MATCH-DEBUG] All enabled actions in store ' + JSON.stringify({
      actionCount: actions.filter(a => a.enabled).length,
      actionNames: actions.filter(a => a.enabled).map(a => a.name),
      allActions: actions.map(a => ({ name: a.name, enabled: a.enabled })),
    }));
    const action = actions.find(a => a.name === evt.actionName && a.enabled);
    if (!action) {
      console.log('[EVENT-MATCH-DEBUG] No matching enabled action found ' + JSON.stringify({
        eventActionName: evt.actionName,
        availableActions: actions.filter(a => a.enabled).map(a => ({ name: a.name, sound: a.sound, video: a.video, image: a.image, keystroke: a.keystroke, minecraft: a.minecraft })),
      }));
      continue;
    }
    console.log('[EVENT-MATCH-DEBUG] Action found for event ' + JSON.stringify({
      eventId: evt.id,
      eventActionName: evt.actionName,
      actionId: action.id,
      actionName: action.name,
      actionSound: action.sound,
      actionVideo: action.video,
      actionImage: action.image,
      actionKeystroke: action.keystroke,
      actionMinecraft: action.minecraft,
    }));

    if (action.globalCooldown && action.globalCooldown > 0) {
      const lastGlobal = globalCooldowns.get(action.id) || 0;
      if (Date.now() - lastGlobal < action.globalCooldown * 1000) {
        console.log('[EVENT-COOLDOWN-SKIP]', {
          eventId: evt.id,
          eventName: evt.actionName,
          cooldown: 'global',
        });
        continue;
      }
    }
    if (action.userCooldown && action.userCooldown > 0) {
      const userMap = userCooldowns.get(action.id) || new Map();
      const lastUser = userMap.get(data.user) || 0;
      if (Date.now() - lastUser < action.userCooldown * 1000) {
        console.log('[EVENT-COOLDOWN-SKIP]', {
          eventId: evt.id,
          eventName: evt.actionName,
          cooldown: 'user',
        });
        continue;
      }
    }

    if (action.globalCooldown) globalCooldowns.set(action.id, Date.now());
    if (action.userCooldown) {
      if (!userCooldowns.has(action.id)) userCooldowns.set(action.id, new Map());
      userCooldowns.get(action.id)!.set(data.user, Date.now());
    }

    console.log('[ACTION-EXECUTING]', {
      eventId: evt.id,
      eventName: evt.actionName,
      actionId: action.id,
      actionName: action.name,
      actionType: action.sound ? 'sound' : action.video ? 'video' : action.image ? 'image' : action.keystroke ? 'keystroke' : action.minecraft ? 'minecraft' : 'other',
    });

    // All actions go through executeAction which handles Repeat Combo media-only queueing
    executeAction(action, data);
  }
}

function matchesTrigger(event: Event, data: any): boolean {
  const triggerType = event.triggerType;
  switch (triggerType) {
    case "gift": return data.type === "gift";
    case "specificgift": return data.type === "gift" && data.giftName?.toLowerCase() === event.giftName?.toLowerCase();
    case "giftcoins": return data.type === "gift" && (data.diamondCount || 0) >= (event.minCoins || 0);
    case "follow": return data.type === "follow";
    case "like": return data.type === "like" && (!event.minLikes || (data.likeCount || 0) >= event.minLikes);
    case "comment": return data.type === "comment" && (!event.keyword || data.comment?.toLowerCase().includes(event.keyword.toLowerCase()));
    case "join": return data.type === "join";
    case "subscribe": return data.type === "subscribe";
    case "command": return data.type === "comment" && data.comment?.toLowerCase().startsWith(event.keyword?.toLowerCase() || "");
    // Guard: gift-only triggers cannot match non-gift events — skip early to avoid misleading logs
    default: return false;
  }
}

// Register the action executor for the queue system
import { setActionExecutor } from "../lib/action-queue";
setActionExecutor(async (action: Action, eventData: any, actionExecutionId: string) => {
  // For mixed-content actions (media + keystroke/minecraft), non-media was already
  // executed immediately in executeAction. The queue only needs to handle media.
  const hasNonMedia = action.keystroke || action.minecraft;
  const mode = hasNonMedia ? 'media-only' : 'all';
  await executeActionNow(action, eventData, actionExecutionId, mode);
});

/**
 * Helper: Check if an action has repeatable media outputs that should be queued.
 * Only video, sound, and image are considered repeatable media.
 * Keystroke, minecraft, streamerbot, obs, etc. are NOT queued.
 */
function hasRepeatableMedia(action: Action): boolean {
  // Check if action has actual media outputs that produce visual/audio content
  const hasVideo = action.video && (action.videoFile || action.videoFileName);
  const hasSound = action.sound && (action.soundFile || action.soundFileName);
  const hasImage = action.image && (action.imageFile || action.imageFileName);

  return hasVideo || hasSound || hasImage;
}

/**
 * Internal execution function - called ONLY by the queue.
 * Uses the provided actionExecutionId for tracking.
 * This function dispatches media to overlay and tracks completion.
 */
async function executeActionNow(action: Action, eventData: any, actionExecutionId: string, executionMode: 'all' | 'non-media-only' | 'media-only' = 'all') {
  // [ACTION-TRACE] gift received
  console.log('[ACTION-TRACE] gift received', JSON.stringify({
    actionId: action.id,
    actionName: action.name,
    actionType: action.sound ? 'sound' : action.video ? 'video' : action.image ? 'image' : action.keystroke ? 'keystroke' : action.minecraft ? 'minecraft' : 'other',
    triggerType: eventData.type,
    giftId: eventData.giftId,
    giftName: eventData.giftName,
    screenId: eventData.screenId,
    timestamp: Date.now(),
  }));

  // [ACTION-TRACE] trigger matched
  console.log('[ACTION-TRACE] trigger matched', JSON.stringify({
    actionId: action.id,
    actionName: action.name,
    eventType: eventData.type,
    giftName: eventData.giftName,
  }));

  // [ACTION-TRACE] action execution started
  console.log('[ACTION-TRACE] action execution started', JSON.stringify({
    actionId: action.id,
    actionName: action.name,
    actionType: action.sound ? 'sound' : action.video ? 'video' : action.image ? 'image' : action.keystroke ? 'keystroke' : action.minecraft ? 'minecraft' : 'other',
    screenId: eventData.screenId,
    overlayScreen: action.overlayScreen,
    timestamp: Date.now(),
  }));

  const electronAPI = api();
  try {
  const vol = (action.soundVolume ?? action.mediaVolume ?? 80) / 100;

  // Load media from Dexie if stripped by Zustand partialize
  let soundFile = action.soundFile;
  let videoFile = action.videoFile;
  let imageFile = action.imageFile;
  if (action.sound && !soundFile) {
    const media = await getActionMedia(action.id, "sound").catch(() => null) as { file: string } | null;
    if (media) soundFile = media.file;
  }
  if (action.video && !videoFile) {
    const media = await getActionMedia(action.id, "video").catch(() => null) as { file: string } | null;
    if (media) videoFile = media.file;
  }
  if (action.image && !imageFile) {
    const media = await getActionMedia(action.id, "image").catch(() => null) as { file: string } | null;
    if (media) imageFile = media.file;
  }

  // [ACTION-TRACE] media asset resolved
  console.log('[ACTION-TRACE] media asset resolved', JSON.stringify({
    actionId: action.id,
    actionName: action.name,
    soundFile: soundFile ? soundFile.substring(0, 100) : null,
    videoFile: videoFile ? videoFile.substring(0, 100) : null,
    imageFile: imageFile ? imageFile.substring(0, 100) : null,
    soundFileFromDB: action.sound && !action.soundFile,
    videoFileFromDB: action.video && !action.videoFile,
    imageFileFromDB: action.image && !action.imageFile,
    timestamp: Date.now(),
  }));

  // Normalize screen for overlay routing
  const normalizedScreen = getNormalizedActionScreen(action);
  const originalScreen = action.overlayScreen || action.screen;

  // [TIKTOK-OVERLAY-SCREEN-TRACE] screen normalization audit
  logScreenTrace(action.id,
    action.sound ? 'sound' : action.video ? 'video' : action.image ? 'image' : action.keystroke ? 'keystroke' : action.minecraft ? 'minecraft' : 'other',
    originalScreen, normalizedScreen,
    action.video ? 'video' : action.image ? 'image' : action.sound ? 'sound' : 'action');

  // Use the execution ID passed from the queue (for repeatCombo tracking)
  // Log that we're executing with this ID
  console.log('[ACTION-EXECUTION] MEDIA DISPATCH', JSON.stringify({
    executionId: actionExecutionId,
    actionId: action.id,
    actionName: action.name,
    screen: normalizedScreen,
    timestamp: Date.now(),
  }));

  // ── Play sound effect - ROUTE TO OVERLAY WIDGET ──
  if (executionMode !== 'non-media-only' && action.sound && soundFile) {
    // [ACTION-TRACE] media output requested - sound
    console.log('[ACTION-TRACE] media output requested', JSON.stringify({
      actionId: action.id,
      mediaType: 'sound',
      soundFile: soundFile.substring(0, 100),
      volume: vol,
      playbackContext: 'overlay-widget',
      actionExecutionId,
      timestamp: Date.now(),
    }));

    // Dispatch sound event to overlay widget (for TikTok LIVE Studio Browser Source capture)
    const soundOverlayData = {
      type: "sound",
      actionName: action.name,
      screen: normalizedScreen,
      soundFile,
      soundVolume: vol,
      actionExecutionId,
      actionId: action.id,
      soundFadeIn: action.soundFadeIn || 0,
      soundFadeOut: action.soundFadeOut || 0,
      soundLoop: action.soundLoop || false,
      timestamp: Date.now(),
    };

    console.log('[OVERLAY-DISPATCH]', {
      actionId: action.id,
      actionName: action.name,
      overlayId: normalizedScreen,
      overlayData: {
        type: "sound",
        actionName: action.name,
        screen: normalizedScreen,
        soundFile: soundFile.substring(0, 100),
      },
    });
    sendToOverlay(soundOverlayData);

    // [ACTION-TRACE] overlay dispatch sent - sound
    console.log('[ACTION-TRACE] overlay dispatch sent', JSON.stringify({
      actionId: action.id,
      type: "sound",
      screen: normalizedScreen,
      channels: ['BroadcastChannel', 'CustomEvent', 'localStorage', 'SSE'],
      timestamp: Date.now(),
    }));
  }

  // ── Send visual to overlay ──
  const screen = action.overlayScreen || "1";
  const overlayData: Record<string, unknown> = {
    type: action.video ? "video" : action.image ? "image" : "action",
    actionName: action.name,
    screen,
    videoFile,
    imageFile,
    duration: action.displayDuration || action.duration || 5,
    fadeInOut: action.fadeInOut,
    eventData,
    // Queue tracking
    actionExecutionId,
    actionId: action.id,
    // Sound properties
    soundVolume: vol,
    soundFadeIn: action.soundFadeIn || 0,
    soundFadeOut: action.soundFadeOut || 0,
    soundLoop: action.soundLoop || false,
    // Video properties
    videoAutoplay: action.videoAutoplay !== false,
    videoLoop: action.videoLoop || false,
    videoSpeed: action.videoSpeed || 1,
    videoFadeIn: action.videoFadeIn || 0,
    videoFadeOut: action.videoFadeOut || 0,
    // Image properties
    imageOpacity: action.imageOpacity ?? 100,
    imageScale: action.imageScale ?? 100,
    imagePosition: action.imagePosition || { x: 50, y: 50 },
    imageAnimation: action.imageAnimation || "none",
    // Keystroke properties
    keystrokeKeys: action.keystrokeKeys,
    keystrokeHoldMs: action.keystrokeHoldMs || 100,
    keystrokeDuration: action.keystrokeDuration || 5,
    keystrokeOpacity: action.keystrokeOpacity ?? 100,
    keystrokeScale: action.keystrokeScale ?? 100,
    keystrokeAnimation: action.keystrokeAnimation || "fade",
  };

  // Update overlayData with normalized screen
  overlayData.screen = normalizedScreen;

  // [ACTION-TRACE] media output requested - video/image
  if (action.video && videoFile) {
    console.log('[ACTION-TRACE] media output requested', JSON.stringify({
      actionId: action.id,
      mediaType: 'video',
      videoFile: videoFile.substring(0, 100),
      targetScreen: normalizedScreen,
      targetOverlayScreen: action.overlayScreen,
      timestamp: Date.now(),
    }));
  }
  if (action.image && imageFile) {
    console.log('[ACTION-TRACE] media output requested', JSON.stringify({
      actionId: action.id,
      mediaType: 'image',
      imageFile: imageFile.substring(0, 100),
      targetScreen: normalizedScreen,
      targetOverlayScreen: action.overlayScreen,
      timestamp: Date.now(),
    }));
  }

  console.log('[OVERLAY-DISPATCH]', {
    actionId: action.id,
    actionName: action.name,
    overlayId: normalizedScreen,
    overlayData: {
      type: overlayData.type,
      actionName: overlayData.actionName,
      screen: overlayData.screen,
      duration: overlayData.duration,
    },
  });
  // In non-media-only mode, skip media overlay dispatch (keystroke/minecraft handled separately)
  if (executionMode !== 'non-media-only') {
    sendToOverlay(overlayData);

    // Preload next queued video to eliminate gap between sequential playbacks.
    // Peek at queue, dispatch preload event so overlay-widget can start loading early.
    if (overlayData.type === 'video') {
      const nextEvent = peekNextQueued(normalizedScreen);
      if (nextEvent?.type === 'video' && nextEvent?.videoFile) {
        window.dispatchEvent(new CustomEvent('rosae:preload-video', {
          detail: { type: 'preload-next', nextEvent }
        }));
      }
    }
  }

  // [ACTION-TRACE] overlay dispatch sent
  console.log('[ACTION-TRACE] overlay dispatch sent', JSON.stringify({
    actionId: action.id,
    type: overlayData.type,
    screen: normalizedScreen,
    channels: ['BroadcastChannel', 'CustomEvent', 'localStorage', 'SSE'],
    timestamp: Date.now(),
  }));

  // ── Forward to Event Bus V2 ──
  dispatchToEventBus(eventData);

  // ── Send keystrokes to overlay and Electron ──
  // In media-only mode (queued), skip keystroke — it was already executed immediately
  if (executionMode !== 'media-only' && action.keystroke && action.keystrokeKeys) {
    // Send keystroke event to overlay for visual display
    sendToOverlay({
      type: "keystroke",
      event: "triggered",
      screen: normalizedScreen,
      keys: action.keystrokeKeys.split(/\s+/).filter(Boolean),
      mouseButtons: [],
      duration: action.keystrokeDuration || 5,
      opacity: action.keystrokeOpacity ?? 100,
      scale: action.keystrokeScale ?? 100,
      animation: action.keystrokeAnimation || "fade",
      source: "action-trigger",
      eventData,
      actionExecutionId,
      actionId: action.id,
      timestamp: Date.now(),
    });
    // Also send to Electron for actual input simulation
    if (electronAPI) {
      electronAPI.sendKeystrokes(action.keystrokeKeys, {
        holdMs: action.keystrokeHoldMs || 100,
        eventData,
      });
    }
  }

  // ── Execute Minecraft command ──
  // In media-only mode (queued), skip minecraft — it was already executed immediately
  if (executionMode !== 'media-only' && action.minecraft && action.minecraftCommand && electronAPI) {
    const cmd = action.minecraftCommand
      .replace(/\{username\}/gi, eventData.user || "")
      .replace(/\{nickname\}/gi, eventData.nickname || "")
      .replace(/\{giftname\}/gi, eventData.giftName || "")
      .replace(/\{comment\}/gi, eventData.comment || "");
    // Minecraft delay
    const executeMc = () => {
      try {
        electronAPI.mcExecute({ command: cmd });
      } catch (_) {}
    };
    if (action.minecraftDelay && action.minecraftDelay > 0) {
      setTimeout(executeMc, action.minecraftDelay * 1000);
    } else {
      executeMc();
    }
  }

  // ── Trigger Streamer.bot ──
  // In media-only mode (queued), skip streamerbot — it was already triggered immediately
  if (executionMode !== 'media-only' && electronAPI) {
    electronAPI.sbTrigger({ actionName: action.name, eventData });
  }

  // ── Switch OBS scene if configured ──
  // In media-only mode (queued), skip OBS — it was already switched immediately
  if (executionMode !== 'media-only' && electronAPI && action.overlayScreen) {
    safeInvoke(electronAPI.obsSwitchScene, { sceneName: `Screen ${action.overlayScreen}` });
  }

  console.log('[ACTION-SUCCESS]', {
    actionId: action.id,
    actionName: action.name,
  });
  } catch (err) {
    console.error('[ACTION-FAILED]', {
      actionId: action.id,
      actionName: action.name,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Public executeAction - entry point for all action execution.
 * Handles Repeat Combo queue logic with media eligibility checking.
 */
export async function executeAction(action: Action, eventData: any) {
  const normalizedScreen = getNormalizedActionScreen(action);
  const actionExecutionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  console.log('[REPEAT-COMBO-QUEUE] trigger-received', JSON.stringify({
    actionExecutionId,
    actionId: action.id,
    actionName: action.name,
    screen: normalizedScreen,
    timestamp: Date.now(),
  }));

  // Check media eligibility for queue serialization.
  // Video actions ALWAYS queue (prevents overlap/replacement on rapid triggers).
  // Non-video media (sound/image) queue only when repeatCombo is enabled.
  const shouldQueue = hasRepeatableMedia(action) && (action.video || action.repeatCombo === true);

  // Detect mixed-content actions (media + non-media like keystroke/minecraft)
  const hasNonMedia = action.keystroke || action.minecraft;
  const hasMedia = action.video || action.sound || action.image;

  console.log('[REPEAT-COMBO-ELIGIBILITY]', JSON.stringify({
    actionId: action.id,
    actionName: action.name,
    repeatCombo: action.repeatCombo,
    hasVideo: action.video,
    hasSound: action.sound,
    hasImage: action.image,
    hasKeystroke: action.keystroke,
    hasMinecraft: action.minecraft,
    hasNonMedia,
    hasMedia,
    shouldQueue,
    screen: normalizedScreen,
    actionExecutionId,
    timestamp: Date.now(),
  }));

  if (shouldQueue) {
    // Each event = exactly one queue entry. No combo merging, no deduplication.

    // ── MIXED CONTENT: execute non-media immediately ──
    if (hasNonMedia) {
      await executeActionNow(action, eventData, actionExecutionId, 'non-media-only');
    }

    // ── Queue ONE entry for this event ──
    console.log('[ACTION-ENQUEUED]', JSON.stringify({
      actionId: action.id,
      actionName: action.name,
      executionId: actionExecutionId,
      screen: normalizedScreen,
      queueLength: 'will-check',
      timestamp: Date.now(),
    }));

    const enqueued = enqueueAction(normalizedScreen, action, eventData, actionExecutionId);
    if (!enqueued) {
      console.warn('[ACTION-ENQUEUE-FULL]', JSON.stringify({
        actionId: action.id,
        actionName: action.name,
        screen: normalizedScreen,
        timestamp: Date.now(),
      }));
    }
    return;
  }

  // Non-queued actions execute immediately (no repeatCombo, or repeatCombo without media)
  await executeActionNow(action, eventData, actionExecutionId);
}

// ─── [COIN-JAR-REAL-TEST] Manual Gift Injection ─────────
// Expose on window so you can test from the browser console:
//   window.__coinJarProInjectGift({ giftName: 'Rose', giftId: '5784', diamondCount: 1 })
//   window.__coinJarProInjectGift({ giftName: 'Lion', giftId: '5785', diamondCount: 20, repeatCount: 3 })
if (typeof window !== 'undefined') {
  (window as any).__coinJarProInjectGift = (params: {
    giftName: string;
    giftId?: string;
    diamondCount?: number;
    repeatCount?: number;
    username?: string;
    screenId?: string;
  }) => {
    const syntheticEvent = {
      type: 'gift',
      giftName: params.giftName,
      giftId: params.giftId || '',
      diamondCount: params.diamondCount ?? 1,
      repeatCount: params.repeatCount ?? 1,
      user: params.username || 'TestUser',
      screenId: params.screenId || 'screen-0',
      timestamp: Date.now(),
    };
    console.log('[COIN-JAR-REAL-TEST] MANUAL INJECTION via dispatchTikTokEvent', syntheticEvent);
    dispatchTikTokEvent(syntheticEvent);
  };
}
