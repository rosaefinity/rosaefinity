import { useAppStore } from "./app-store";
import { sendToOverlay } from "../lib/overlay-bus";
import { db, getActionMedia } from "../lib/db";
import { dispatchToEventBus } from "../events/EventDispatcher";
import { api, safeInvoke } from "../services/electron-service";
import { normalizeScreen, getNormalizedActionScreen, logScreenTrace } from "../lib/screen-normalizer";
import { enqueueAction, notifyActionComplete, peekNextQueued, clearQueue } from "../lib/action-queue";
import { useCoinJarStore, isDuplicateGift } from "./coin-jar-store";
import type { Action, Event, LiveEvent, ScreenId } from "../types";
import { getGiftsSync, getGiftImageUrl } from "../services/gift-service";
import { trackGoalEvent, trackGoalOverlayEvents } from "../goals/goal-tracker";
import { getTikTokEngine } from "../engine/tiktok/tiktok-engine";
import { overlayDebugEnabled } from "../lib/overlay-debug";

const globalCooldowns: Map<string, number> = new Map();
const userCooldowns: Map<string, Map<string, number>> = new Map();

// ── RepeatCount delta tracking for coin-jar ──
// TikTok's repeatCount is CUMULATIVE (total seen), not per-event delta.
// Track per-gift cumulative repeatCount to calculate the true delta.
const lastGiftRepeatCount = new Map<string, number>();

function getGiftTrackKey(data: any): string {
  return [data.screenId || 'screen-0', data.roomId || 'room-unknown', data.user || 'unknown', data.giftId || data.giftName || 'gift'].join(':');
}

function getGiftDelta(data: any): number {
  const repeatCount = Math.max(1, Number(data.repeatCount) || 1);
  const key = getGiftTrackKey(data);
  const previous = lastGiftRepeatCount.get(key);
  lastGiftRepeatCount.set(key, repeatCount);
  if (previous === undefined) return repeatCount;
  return Math.max(0, repeatCount - previous);
}

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

  if (overlayDebugEnabled()) console.log('[EVENT-RECEIVED]', {
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
    if (overlayDebugEnabled()) {
      console.log('[REAL-GIFT-DEBUG][DISPATCH-INPUT]', JSON.stringify({
        type: data.type,
        screenId: data.screenId,
        giftId: data.giftId || '(empty)',
        giftName: data.giftName || '(empty)',
        repeatCount: data.repeatCount || 1,
        diamondCount: data.diamondCount || 0,
        giftImageUrl: data.giftImageUrl || '(empty)',
      }));
    }
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

    if (overlayDebugEnabled()) {
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
      const giftTrackKey = getGiftTrackKey(data);
      const prevRepeatCountForCoins = data.repeatCountCumulative === true
        ? lastGiftRepeatCount.get(giftTrackKey)
        : undefined;
      const deltaRepeatCount = data.repeatCountCumulative === true ? getGiftDelta(data) : 1;

      // Evict stale entries
      if (lastGiftRepeatCount.size > 200) {
        const keys = Array.from(lastGiftRepeatCount.keys());
        for (let i = 0; i < keys.length - 100; i++) {
          lastGiftRepeatCount.delete(keys[i]);
        }
      }

      // Normalized TikTok gifts use cumulative repeatCount; duplicate counts add nothing.
      const effectiveDelta = data.repeatCountCumulative === true ? deltaRepeatCount : 1;

      data.normalizedGiftDelta = effectiveDelta;
      data.normalizedComboCount = repeatCount;

      // Coin value uses the normalized cumulative delta.
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
    } else {
      // Non-debug path: still compute delta and update coin jar
      const giftTrackKey = getGiftTrackKey(data);
      const prevRepeatCountForCoins = data.repeatCountCumulative === true
        ? lastGiftRepeatCount.get(giftTrackKey)
        : undefined;
      const deltaRepeatCount = data.repeatCountCumulative === true ? getGiftDelta(data) : 1;

      // Evict stale entries
      if (lastGiftRepeatCount.size > 200) {
        const keys = Array.from(lastGiftRepeatCount.keys());
        for (let i = 0; i < keys.length - 100; i++) {
          lastGiftRepeatCount.delete(keys[i]);
        }
      }

      const effectiveDelta = data.repeatCountCumulative === true ? deltaRepeatCount : 1;

      data.normalizedGiftDelta = effectiveDelta;
      data.normalizedComboCount = repeatCount;

      const deltaCoinValue = diamondCount * effectiveDelta;

      // Combo safety
      const isDuplicate = isDuplicateGift(giftId, userId, repeatCount, timestamp);
      if (deltaCoinValue > 0 && !isDuplicate) {
        // STORE_UPDATED + SSE_BROADCAST — use delta, not cumulative
        useCoinJarStore.getState().addGiftAmount(deltaCoinValue, data.giftName, giftId, rawImageUrl);
      }

      // ── Points: award per-gift using the same effectiveDelta ──
      if (effectiveDelta > 0 && !isDuplicate) {
        useAppStore.getState().awardPoints("gift", data.user, data.nickname, effectiveDelta);
      }
    }
  }

  // ── Goal tracking (independent from Screen 1-8) ──
  trackGoalEvent(data);
  // Instance-based goal tracking for new goal-likes/followers/gifts modules
  trackGoalOverlayEvents(data);

  // ── Handle disconnect cleanup ──
  if (data.type === "disconnected") {
    const screenId: ScreenId = data.screenId || "screen-0";
    for (const key of lastGiftRepeatCount.keys()) {
      if (key.startsWith(`${screenId}:`)) lastGiftRepeatCount.delete(key);
    }
    if (overlayDebugEnabled()) console.log('[DISPATCH-CLEANUP] TikTok disconnected, clearing state for screen', screenId);
    // Clear action queue
    clearQueue(screenId);
    // Clear event pipeline cooldowns and queue
    const tiktokEngine = getTikTokEngine();
    tiktokEngine.clearCooldowns();
    tiktokEngine.clearPipelineQueue();
    // Clear comment engine state
    tiktokEngine.clearCommentEngine();
    if (overlayDebugEnabled()) console.log('[DISPATCH-CLEANUP] Cleared queue, pipeline, and comment engine for screen', screenId);
  }

  cleanupStaleCooldowns();
  const store = useAppStore.getState();
  const { events, actions, alertSettings } = store;
  const alertsMasterEnabled = store.getAlertsMasterEnabled();

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
    case "gift": {
      if (!data.combo || Number(data.normalizedGiftDelta) > 0) store.incrementScreenStat(screenId, "gifts");
      break;
    }
    case "like": store.incrementScreenStat(screenId, "likes"); break;
    case "follow": store.incrementScreenStat(screenId, "follows"); break;
    case "subscribe": store.incrementScreenStat(screenId, "follows"); break;
    case "join": {
      const views = store.screenConnections[screenId]?.stats.views || 0;
      store.setScreenStats(screenId, { views: views + 1 });
      break;
    }
  }

  // ── Points: award for FOLLOW and LIKE (GIFT handled above in coin-jar block) ──
  switch (data.type) {
    case "follow":
      useAppStore.getState().awardPoints("follow", data.user, data.nickname, 1);
      break;
    case "like":
      useAppStore.getState().awardPoints("like", data.user, data.nickname, data.likeCount || 1);
      break;
  }

  // Find matching events and execute actions
  if (overlayDebugEnabled()) {
    console.log('[EVENT-MATCHING]', {
      incomingType: data.type,
      incomingGiftName: data.giftName,
      incomingGiftId: data.giftId,
      incomingDiamondCount: data.diamondCount,
      incomingUser: data.user,
      enabledEventCount: events.filter(e => e.enabled).length,
      totalEventCount: events.length,
    });
  }

  // STEP 6 DIAGNOSTIC: Log every enabled event's config for comparison
  const enabledEvents = events.filter(e => e.enabled);
  if (overlayDebugEnabled()) {
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
  }

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
    if (overlayDebugEnabled()) {
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
  }

  if (overlayDebugEnabled()) {
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
  }
  for (const evt of matchingEvents) {
    // Determine which action(s) to execute
    let selectedActionName = evt.actionName;

    // If actionNames array exists with 2+ actions, randomly select one
    if (evt.actionNames && evt.actionNames.length > 1) {
      const randomIndex = Math.floor(Math.random() * evt.actionNames.length);
      selectedActionName = evt.actionNames[randomIndex];
      if (overlayDebugEnabled()) {
        console.log('[EVENT-RANDOM-SELECT]', {
          eventId: evt.id,
          totalActions: evt.actionNames.length,
          selectedIndex: randomIndex,
          selectedAction: selectedActionName,
        });
      }
    }

    if (overlayDebugEnabled()) {
      console.log('[EVENT-MATCH-DEBUG] All enabled actions in store ' + JSON.stringify({
        actionCount: actions.filter(a => a.enabled).length,
        actionNames: actions.filter(a => a.enabled).map(a => a.name),
        allActions: actions.map(a => ({ name: a.name, enabled: a.enabled })),
      }));
    }
    const action = actions.find(a => a.name === selectedActionName && a.enabled);
    if (!action) {
      if (overlayDebugEnabled()) {
        console.log('[EVENT-MATCH-DEBUG] No matching enabled action found ' + JSON.stringify({
          eventActionName: selectedActionName,
          availableActions: actions.filter(a => a.enabled).map(a => ({ name: a.name, sound: a.sound, video: a.video, image: a.image, keystroke: a.keystroke, minecraft: a.minecraft })),
        }));
      }
      continue;
    }
    if (overlayDebugEnabled()) {
      console.log('[EVENT-MATCH-DEBUG] Action found for event ' + JSON.stringify({
        eventId: evt.id,
        eventActionName: selectedActionName,
        actionId: action.id,
        actionName: action.name,
        actionSound: action.sound,
        actionVideo: action.video,
        actionImage: action.image,
        actionKeystroke: action.keystroke,
        actionMinecraft: action.minecraft,
      }));
    }

    if (action.globalCooldown && action.globalCooldown > 0) {
      const lastGlobal = globalCooldowns.get(action.id) || 0;
      if (Date.now() - lastGlobal < action.globalCooldown * 1000) {
        if (overlayDebugEnabled()) {
          console.log('[EVENT-COOLDOWN-SKIP]', {
            eventId: evt.id,
            eventName: evt.actionName,
            cooldown: 'global',
          });
        }
        continue;
      }
    }
    if (action.userCooldown && action.userCooldown > 0) {
      const userMap = userCooldowns.get(action.id) || new Map();
      const lastUser = userMap.get(data.user) || 0;
      if (Date.now() - lastUser < action.userCooldown * 1000) {
        if (overlayDebugEnabled()) {
          console.log('[EVENT-COOLDOWN-SKIP]', {
            eventId: evt.id,
            eventName: evt.actionName,
            cooldown: 'user',
          });
        }
        continue;
      }
    }

    if (action.globalCooldown) globalCooldowns.set(action.id, Date.now());
    if (action.userCooldown) {
      if (!userCooldowns.has(action.id)) userCooldowns.set(action.id, new Map());
      userCooldowns.get(action.id)!.set(data.user, Date.now());
    }

    if (overlayDebugEnabled()) {
      console.log('[ACTION-EXECUTING]', {
        eventId: evt.id,
        eventName: evt.actionName,
        actionId: action.id,
        actionName: action.name,
        actionType: action.sound ? 'sound' : action.video ? 'video' : action.image ? 'image' : action.keystroke ? 'keystroke' : action.minecraft ? 'minecraft' : 'other',
      });
    }

    const isCombo = data.combo === true || data.gift?.combo === true;
    const incrementCount = isCombo ? (Number(data.normalizedGiftDelta) || 0) : 1;
    if (incrementCount <= 0) continue;
    const executions = incrementCount;
    for (let increment = 0; increment < executions; increment += 1) {
      const executionId = executions > 1
        ? `exec-combo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        : undefined;
      void executeAction(action, executionId ? { ...data, repeatCount: 1, _comboExecutionId: executionId } : data, executionId ? {
        actionExecutionIdOverride: executionId,
        comboDeferredAdmission: true,
        source: 'gift-combo',
      } : undefined);
    }
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
  const hasNonMedia = action.keystroke || action.minecraft || action.obs || action.streamerbot || action.spotify;
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
export function dispatchActionKeystroke(action: Action, opts: { rfKeyId: string; eventData: unknown }): void {
  if (!action.keystroke || !action.keystrokeKeys) return;
  api()?.sendKeystrokes(action.keystrokeKeys, { holdMs: action.keystrokeHoldMs || 100, eventData: opts.eventData, rfKeyId: opts.rfKeyId });
}

export function executeDeferredTestKeystroke(action: Action, eventData: unknown, rfKeyId?: string): void {
  if (!action.keystroke || !action.keystrokeKeys) return;
  dispatchActionKeystroke(action, { rfKeyId: rfKeyId || `RF-KEY-${Date.now()}`, eventData });
}

async function executeActionNow(action: Action, eventData: any, actionExecutionId: string, executionMode: 'all' | 'non-media-only' | 'media-only' | 'test-bypass' = 'all') {
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
    const lifecycleRows = await db.mediaFiles.where('actionId').equals(action.id).toArray();
    const lifecycleRow = lifecycleRows.find((row) => row.type === 'image') ?? null;
    console.log('[IMAGE-MEDIA-LIFECYCLE-DIAG]', JSON.stringify({
      operation: 'getActionMedia',
      stage: 'before-lookup',
      actionId: action.id,
      actionExecutionId,
      currentProfileId: useAppStore.getState().currentProfileId,
      matchingMediaRow: Boolean(lifecycleRow),
      rowId: lifecycleRow?.id ?? null,
      rowType: lifecycleRow?.type ?? null,
      hasFile: typeof lifecycleRow?.file === 'string' && lifecycleRow.file.length > 0,
      fileLength: typeof lifecycleRow?.file === 'string' ? lifecycleRow.file.length : 0,
      mediaRef: lifecycleRow?.mediaRef ?? null,
      relevantActionIds: useAppStore.getState().actions.map((currentAction) => currentAction.id),
    }));
    console.log('[IMAGE-EXEC-LOOKUP]', JSON.stringify({ actionId: action.id, actionExecutionId }));
    const media = await getActionMedia(action.id, "image").catch(() => null) as { file?: string; id?: string; actionId?: string; type?: string; mediaRef?: string } | null;
    console.log('[IMAGE-EXEC-RESULT]', JSON.stringify({
      actionId: action.id,
      actionExecutionId,
      found: Boolean(media),
      hasFile: Boolean(media?.file),
      fileLength: typeof media?.file === 'string' ? media.file.length : 0,
      id: media?.id ?? null,
      mediaActionId: media?.actionId ?? null,
      type: media?.type ?? null,
      mediaRef: media?.mediaRef ?? null,
    }));
    if (media?.file) imageFile = media.file;
  }

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
      duration: action.displayDuration || action.duration || 5,
      timestamp: Date.now(),
    };

    sendToOverlay(soundOverlayData);

  }

  // ── Send visual to overlay ──
  // For test-bypass (manual Test Actions), only send overlay events for effects that
  // produce visible/audible output. Skip generic "action" type which renders a purple
  // "ACTION @someone" card. Live events and queued executions continue to use "action"
  // type for alert-card display when no specific media is configured.
  const hasVisualMedia = action.video || action.image;
  const hasKeystrokeVisual = action.keystroke && action.keystrokeKeys;
  const shouldSendOverlay = executionMode !== 'test-bypass' || hasVisualMedia || hasKeystrokeVisual;

  const overlayType = action.video ? "video" : action.image ? "image" : (hasKeystrokeVisual ? "keystroke" : "action");

  const screen = action.overlayScreen || "1";
  const overlayData: Record<string, unknown> = {
    type: overlayType,
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

  // In non-media-only mode, skip media overlay dispatch (keystroke/minecraft handled separately)
  // For test-bypass, only send if there's actual visual media or keystroke to display
  if (executionMode !== 'non-media-only' && shouldSendOverlay) {
    console.log('[IMAGE-EXEC-PAYLOAD]', JSON.stringify({
      type: overlayData.type,
      actionExecutionId,
      screen: overlayData.screen,
      hasImageFile: Boolean(overlayData.imageFile),
      imageFileLength: typeof overlayData.imageFile === 'string' ? overlayData.imageFile.length : 0,
    }));
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
  if (executionMode !== 'media-only' && electronAPI && action.streamerbot && action.sbActionName) {
    electronAPI.sbTrigger({ actionName: action.sbActionName, eventData });
  }

  // ── Switch OBS scene if configured ──
  // In media-only mode (queued), skip OBS — it was already switched immediately
  if (executionMode !== 'media-only' && electronAPI && action.obs && action.obsSceneName) {
    safeInvoke(electronAPI.obsSwitchScene, { sceneName: action.obsSceneName });
  }

  // ── Execute Spotify action if configured ──
  // In media-only mode (queued), skip Spotify
  if (executionMode !== 'media-only' && electronAPI && action.spotify && action.spotifyAction) {
    try {
      if (action.spotifyAction === "addToQueue" && action.spotifyTrackUri) {
        electronAPI.spotifyAddToQueue({ uri: action.spotifyTrackUri });
      } else if (action.spotifyAction === "skip") {
        electronAPI.spotifySkip();
      }
    } catch (_) {}
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
export async function executeAction(action: Action, eventData: any, options?: { bypassQueue?: boolean; actionExecutionIdOverride?: string; comboDeferredAdmission?: boolean; source?: 'gift-combo' }) {
  const normalizedScreen = getNormalizedActionScreen(action);
  const actionExecutionId = options?.actionExecutionIdOverride || `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  console.log('[REPEAT-COMBO-QUEUE] trigger-received', JSON.stringify({
    actionExecutionId,
    actionId: action.id,
    actionName: action.name,
    screen: normalizedScreen,
    timestamp: Date.now(),
  }));

  // Test button bypass: execute immediately without queue
  if (options?.bypassQueue) {
    console.log('[ACTION-TEST-BYPASS] queue bypassed for test execution', JSON.stringify({
      actionId: action.id,
      actionName: action.name,
      screen: normalizedScreen,
      timestamp: Date.now(),
    }));
    // For manual Test Actions, only dispatch overlay events for effects that produce
    // visible/audible output. Skip the generic "action" type which renders a purple
    // "ACTION @someone" card in the overlay widget.
    await executeActionNow(action, eventData, actionExecutionId, 'test-bypass');
    return;
  }

  // Check media eligibility for queue serialization.
  // Video actions ALWAYS queue (prevents overlap/replacement on rapid triggers).
  // Non-video media (sound/image) queue only when repeatCombo is enabled.
  const shouldQueue = hasRepeatableMedia(action) && (action.video || action.repeatCombo === true);

  // Detect mixed-content actions (media + non-media like keystroke/minecraft)
  const hasNonMedia = action.keystroke || action.minecraft || action.obs || action.streamerbot || action.spotify;
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

    const enqueued = enqueueAction(normalizedScreen, action, eventData, actionExecutionId, options?.comboDeferredAdmission === true, options?.source);
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
  (window as any).__inspectImageMedia = async (actionId = 'act_jdot52a2') => {
    const actionRows = await db.mediaFiles.where('actionId').equals(actionId).toArray();
    const imageRows = await db.mediaFiles.where('type').equals('image').toArray();
    const actionRowIds = new Set(actionRows.map((row) => row.id));
    const mediaRefs = new Set(actionRows.map((row) => row.mediaRef).filter((ref): ref is string => Boolean(ref)));
    const relevantImageRows = imageRows.filter((row) =>
      row.actionId === actionId || actionRowIds.has(row.id) || mediaRefs.has(row.id)
    );
    const toMetadata = (row: typeof imageRows[number]) => ({
      id: row.id,
      actionId: row.actionId,
      type: row.type,
      hasFile: typeof row.file === 'string' && row.file.length > 0,
      fileLength: typeof row.file === 'string' ? row.file.length : 0,
      mediaRef: row.mediaRef ?? null,
    });
    const result = {
      actionId,
      actionRows: actionRows.map(toMetadata),
      relevantImageRows: relevantImageRows.map(toMetadata),
      expectedImageRowPresent: actionRows.some(
        (row) => row.id === `${actionId}_image` && row.type === 'image'
      ),
      lookup: null as Record<string, unknown> | null,
    };
    const lookup = await getActionMedia(actionId, 'image');
    result.lookup = lookup ? {
      found: true,
      hasFile: typeof lookup.file === 'string' && lookup.file.length > 0,
      fileLength: typeof lookup.file === 'string' ? lookup.file.length : 0,
      id: lookup.id ?? null,
      actionId: lookup.actionId ?? null,
      type: lookup.type ?? null,
      mediaRef: lookup.mediaRef ?? null,
    } : { found: false, hasFile: false, fileLength: 0, id: null, actionId: null, type: null, mediaRef: null };
    console.log('[IMAGE-MEDIA-INSPECT]', JSON.stringify(result));
    return result;
  };

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
