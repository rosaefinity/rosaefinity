// ═══════════════════════════════════════════════════════════════════
// Action Execution Queue — Sequential FIFO per screen
// Handles repeat combo: one action at a time per screen, queue others
// Media-aware: tracks video/sound/image completion per action execution
// ═══════════════════════════════════════════════════════════════════

import type { Action } from '../types';
import { useAppStore } from '../store/app-store';
import { SCREEN_IDS } from '../types';
import { overlayDebugEnabled } from './overlay-debug';

export interface QueuedAction {
  id: string;
  action: Action;
  eventData: any;
  enqueueTime: number;
  actionExecutionId: string; // unique per execution attempt, passed from caller
}

// Track pending media completions for each active execution
interface PendingMedia {
  video?: boolean;
  sound?: boolean;
  image?: boolean;
  keystroke?: boolean;
  minecraft?: boolean;
  streamerbot?: boolean;
  obs?: boolean;
}

interface ActiveExecution {
  queuedAction: QueuedAction;
  actionExecutionId: string;
  actionId: string;
  actionName: string;
  screen: string;
  pendingMedia: PendingMedia;
  mediaOutputs: {
    hasVideo: boolean;
    hasSound: boolean;
    hasImage: boolean;
    hasKeystroke: boolean;
    hasMinecraft: boolean;
    hasStreamerbot: boolean;
    hasObs: boolean;
  };
  startTime: number;
  completionResolvers: ((value: void | PromiseLike<void>) => void)[];
  isCompleting: boolean;
}

interface ScreenQueue {
  queue: QueuedAction[];
  deferred: QueuedAction[];
  activeExecution: ActiveExecution | null;
}

const MAX_DEFERRED_PER_SCREEN = 100; // bounded combo backlog; raise only with explicit persistence/backpressure design.

const screenQueues: Map<string, ScreenQueue> = new Map();
const DEFAULT_MAX_QUEUE_LENGTH = 5;

// Per-screen max queue length cache - populated from app-store
const maxQueueLengthByScreen: Map<string, number> = new Map();

/**
 * Get the max queue length for a specific screen.
 * Reads from app-store setupConfig.overlayScreensMaxQueue with fallback to default.
 */
export function getMaxQueueLength(screen: string): number {
  const index = Number(screen);
  const configKey = Number.isInteger(index) && index >= 1 ? `screen-${index - 1}` : screen;
  const configured = useAppStore.getState().setupConfig?.overlayScreensMaxQueue?.[configKey];
  const maxQueue = Number.isFinite(configured)
    ? Math.max(1, Math.min(100, Number(configured)))
    : DEFAULT_MAX_QUEUE_LENGTH;
  // Cache every lookup result. Stale fallback values such as 5 are overwritten
  // when config hydrates, which fixes the stale default cache path.
  maxQueueLengthByScreen.set(screen, maxQueue);
  return maxQueue;
}

/**
 * Update max queue length for a screen (called when config changes).
 */
export function updateMaxQueueLength(screen: string, maxQueue: number): void {
  const validated = Math.max(1, Math.min(100, maxQueue || DEFAULT_MAX_QUEUE_LENGTH));
  maxQueueLengthByScreen.set(screen, validated);
}

/**
 * Clear the max queue length cache for a specific screen or all screens.
 * Useful for testing.
 */
export function clearMaxQueueCache(screen?: string): void {
  if (screen) {
    maxQueueLengthByScreen.delete(screen);
  } else {
    maxQueueLengthByScreen.clear();
  }
}

/**
 * Check if an action is a video action (will go to overlay video queue).
 */
function isVideoAction(action: Action): boolean {
  return action.video && (action.videoFile || action.videoFileName);
}

// Executor function that will be set by event-dispatch.ts
let actionExecutor: ((action: Action, eventData: any, actionExecutionId: string) => Promise<void>) | null = null;

/**
 * Register the actual action executor function.
 * Called once from event-dispatch.ts on initialization.
 */
export function setActionExecutor(executor: (action: Action, eventData: any, actionExecutionId: string) => Promise<void>): void {
  actionExecutor = executor;
}

function getScreenQueue(screen: string): ScreenQueue {
  if (!screenQueues.has(screen)) {
    screenQueues.set(screen, {
      queue: [],
      deferred: [],
      activeExecution: null,
    });
  }
  return screenQueues.get(screen)!;
}

function generateActionExecutionId(): string {
  return `exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine which media outputs an action will produce.
 * Used to track pending completions.
 */
interface ActionCompletionPolicy {
  waitForMedia: {
    video: boolean;
    sound: boolean;
    image: boolean;
  };
}

function getActionCompletionPolicy(action: Action): ActionCompletionPolicy {
  return {
    // Only overlay media has a reliable existing completion signal. Other
    // effects remain non-blocking because their APIs expose no completion event.
    waitForMedia: {
      video: action.video && !!(action.videoFile || action.videoFileName),
      sound: action.sound && !!(action.soundFile || action.soundFileName),
      image: action.image && !!(action.imageFile || action.imageFileName),
    },
  };
}

function getActionMediaOutputs(action: Action): {
  hasVideo: boolean;
  hasSound: boolean;
  hasImage: boolean;
  hasKeystroke: boolean;
  hasMinecraft: boolean;
  hasStreamerbot: boolean;
  hasObs: boolean;
} {
  const policy = getActionCompletionPolicy(action);
  return {
    hasVideo: policy.waitForMedia.video,
    hasSound: policy.waitForMedia.sound,
    hasImage: policy.waitForMedia.image,
    hasKeystroke: action.keystroke && !!action.keystrokeKeys,
    hasMinecraft: action.minecraft && !!action.minecraftCommand,
    hasStreamerbot: false,
    hasObs: false,
  };
}

export { getActionCompletionPolicy };

/**
 * Enqueue an action for execution on a specific screen.
 * Returns true if enqueued, false if queue is full.
 * Optimization: when queue is idle (empty + no active execution), execute FIRST item immediately
 * to eliminate microtask delay for the initial video (matching bypassQueue behavior).
 */
export function enqueueAction(
  screen: string,
  action: Action,
  eventData: any,
  actionExecutionId?: string,
  deferIfFull = false,
  source?: 'gift-combo' | 'spam10',
): boolean {
  const queue = getScreenQueue(screen);
  const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Use per-screen max queue length
  const maxQueueForScreen = getMaxQueueLength(screen);

  // Check if this is a video action (will go to overlay video queue)
  const incomingIsVideo = action.video && (action.videoFile || action.videoFileName);

  // For video actions, count active execution as occupying 1 slot in overlay video queue
  // This ensures action queue capacity matches overlay video queue capacity
  const activeVideoCount = queue.activeExecution && isVideoAction(queue.activeExecution.queuedAction.action) ? 1 : 0;
  const activeVideoSlot = (incomingIsVideo && activeVideoCount > 0) ? 1 : 0;
  const pendingVideoCount = queue.queue.filter(q => isVideoAction(q.action)).length;
  const deferredVideoCount = queue.deferred.filter(q => isVideoAction(q.action)).length;
  const totalVideoInFlight = pendingVideoCount + activeVideoSlot;
  const admissionMode = deferIfFull ? 'deferred' : 'normal';

  if (totalVideoInFlight >= maxQueueForScreen) {
    console.log('[DEBUG-QUEUE-FULL]', JSON.stringify({
      screen, totalVideoInFlight, maxQueueForScreen, queueLength: queue.queue.length
    }));
    if (deferIfFull && incomingIsVideo && queue.deferred.length < MAX_DEFERRED_PER_SCREEN) {
      const executionId = actionExecutionId || generateActionExecutionId();
      queue.deferred.push({
        id: generateActionExecutionId(),
        action,
        eventData,
        enqueueTime: Date.now(),
        actionExecutionId: executionId,
      });
      if (overlayDebugEnabled()) console.log('[REPEAT-COMBO-QUEUE] deferred action', JSON.stringify({
        admissionMode,
        source,
        actionExecutionId: executionId,
        screen,
        actionId: action.id,
        activeVideoCount,
        pendingVideoCount,
        deferredVideoCount,
        totalVideoInFlight,
        maxQueueLength: maxQueueForScreen,
        deferredLength: queue.deferred.length,
        deferredAt: Date.now(),
      }));
      return true;
    }
    if (overlayDebugEnabled()) console.warn('[REPEAT-COMBO-QUEUE] queue full, dropping action', JSON.stringify({
      admissionMode,
      source,
      actionExecutionId: actionExecutionId || null,
      screen,
      actionId: action.id,
      actionName: action.name,
      activeVideoCount,
      pendingVideoCount,
      deferredVideoCount,
      totalVideoInFlight,
      maxQueueLength: maxQueueForScreen,
      queueLength: queue.queue.length,
      activeExecution: !!queue.activeExecution,
      timestamp: Date.now(),
    }));
    return false;
  }

  const executionId = actionExecutionId || generateActionExecutionId();

  const queuedAction: QueuedAction = {
    id: generateActionExecutionId(),
    action,
    eventData,
    enqueueTime: Date.now(),
    actionExecutionId: executionId,
  };

  // OPTIMIZATION: If queue is idle (no active execution, empty queue), execute immediately
  // to match bypassQueue latency for the FIRST video. Subsequent videos queue FIFO.
  const isQueueIdle = !queue.activeExecution && queue.queue.length === 0;

  if (isQueueIdle) {
    if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
      correlationId,
      stage: 'enqueueAction-immediate-execute',
      executionId,
      actionId: action.id,
      actionName: action.name,
      screen,
      timestamp: Date.now(),
    }));

    // Execute immediately without queueing - replicates bypassQueue path for first video
    queue.activeExecution = {
      queuedAction,
      actionExecutionId: executionId,
      actionId: action.id,
      actionName: action.name,
      screen,
      pendingMedia: {},
      mediaOutputs: getActionMediaOutputs(action),
      startTime: Date.now(),
      completionResolvers: [],
      isCompleting: false,
    };

    // Initialize pending media tracking for repeatable media only
    const mediaOutputs = getActionMediaOutputs(action);
    const pendingMedia: PendingMedia = {};
    if (mediaOutputs.hasVideo) pendingMedia.video = true;
    if (mediaOutputs.hasSound) pendingMedia.sound = true;
    if (mediaOutputs.hasImage) pendingMedia.image = true;
    queue.activeExecution.pendingMedia = pendingMedia;

    // Fire-and-forget execution (same as processQueue does)
    processQueue(screen);
    return true;
  }

  // Normal path: queue the action
  queue.queue.push(queuedAction);

  if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
    correlationId,
    stage: 'enqueueAction',
    executionId,
    actionId: action.id,
    actionName: action.name,
    screen,
    queueLength: queue.queue.length,
    hasActivePlayback: !!queue.activeExecution,
    isVideo: incomingIsVideo,
    timestamp: Date.now(),
  }));

  // Try to process if not already processing
  if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
    correlationId,
    stage: 'processQueue-call',
    executionId,
    screen,
    timestamp: Date.now(),
  }));
  processQueue(screen);

  return true;
}

function promoteDeferred(screen: string): void {
  const queue = getScreenQueue(screen);
  while (queue.deferred.length > 0) {
    const next = queue.deferred[0];
    if (!enqueueAction(screen, next.action, next.eventData, next.actionExecutionId)) return;
    if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({ stage: 'deferred-promoted', screen, actionExecutionId: next.actionExecutionId, deferredWaitMs: Date.now() - next.enqueueTime, timestamp: Date.now() }));
    queue.deferred.shift();
  }
}

/**
 * Enqueue combo work while retaining valid overflow until capacity is available.
 */
export function enqueueDeferredAction(screen: string, action: Action, eventData: any, actionExecutionId?: string): boolean {
  return enqueueAction(screen, action, eventData, actionExecutionId, true);
}

/**
 * Process the queue for a screen. Only runs if not currently processing.
 * If activeExecution is already set (from immediate execute path), skip dequeue and execute it.
 */
async function processQueue(screen: string): Promise<void> {
  const queue = getScreenQueue(screen);
  const correlationId = `corr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
    correlationId,
    stage: 'processQueue-entry',
    screen,
    hasActiveExecution: !!queue.activeExecution,
    queueLength: queue.queue.length,
    timestamp: Date.now(),
  }));

  // If already executing (set by immediate path), don't block - just continue
  if (queue.activeExecution) {
    // If there's nothing in queue, we may be the immediate execution path
    // Check if activeExecution already has pendingMedia initialized
    if (queue.queue.length === 0 && Object.keys(queue.activeExecution.pendingMedia).length > 0) {
      // Already set up - just execute the action
      const active = queue.activeExecution;
      if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
        correlationId,
        stage: 'processQueue-execute-immediate',
        actionExecutionId: active.actionExecutionId,
        actionId: active.actionId,
        actionName: active.actionName,
        screen,
        timestamp: Date.now(),
      }));

      try {
        const completion = waitForCompletion(screen, active.actionExecutionId, {
          video: active.mediaOutputs.hasVideo,
          sound: active.mediaOutputs.hasSound,
          image: active.mediaOutputs.hasImage,
        });
        if (actionExecutor) {
          await actionExecutor(active.queuedAction.action, active.queuedAction.eventData, active.actionExecutionId);
          await completion;
        }
      } catch (error) {
        console.error('[REPEAT-COMBO-QUEUE] immediate action failed', JSON.stringify({
          actionId: active.actionId,
          actionName: active.actionName,
          actionExecutionId: active.actionExecutionId,
          screen,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        }));
      } finally {
        queue.activeExecution = null;
        // Process next item in queue if any
        promoteDeferred(screen);
        if (queue.queue.length > 0) {
          await processQueue(screen);
        }
      }
    } else if (queue.queue.length > 0) {
      // Blocked by another execution
      if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
        correlationId,
        stage: 'processQueue-blocked',
        incomingExecutionId: queue.queue[0]?.actionExecutionId || null,
        activeExecutionId: queue.activeExecution?.actionExecutionId || null,
        queueLength: queue.queue.length,
        timestamp: Date.now(),
      }));
    }
    return;
  }

  if (queue.queue.length === 0) {
    if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
      correlationId,
      stage: 'processQueue-empty',
      screen,
      timestamp: Date.now(),
    }));
    return;
  }

  const nextAction = queue.queue.shift()!;
  const actionExecutionId = nextAction.actionExecutionId;
  const mediaOutputs = getActionMediaOutputs(nextAction.action);

  if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
    correlationId,
    stage: 'processQueue-dequeue',
    actionExecutionId,
    actionId: nextAction.action.id,
    actionName: nextAction.action.name,
    screen,
    enqueueTime: nextAction.enqueueTime,
    waitTimeMs: Date.now() - nextAction.enqueueTime,
    queueWaitMs: Date.now() - nextAction.enqueueTime,
    pendingMedia: { video: mediaOutputs.hasVideo, sound: mediaOutputs.hasSound, image: mediaOutputs.hasImage },
    timestamp: Date.now(),
  }));

  // Initialize pending media tracking for repeatable media only
  const pendingMedia: PendingMedia = {};
  if (mediaOutputs.hasVideo) pendingMedia.video = true;
  if (mediaOutputs.hasSound) pendingMedia.sound = true;
  if (mediaOutputs.hasImage) pendingMedia.image = true;

  // Non-media outputs don't block the queue
  const nonMediaOutputs = {
    hasKeystroke: mediaOutputs.hasKeystroke,
    hasMinecraft: mediaOutputs.hasMinecraft,
    hasStreamerbot: mediaOutputs.hasStreamerbot,
    hasObs: mediaOutputs.hasObs,
  };

  const activeExecution: ActiveExecution = {
    queuedAction: nextAction,
    actionExecutionId,
    actionId: nextAction.action.id,
    actionName: nextAction.action.name,
    screen,
    pendingMedia,
    mediaOutputs,
    startTime: Date.now(),
    completionResolvers: [],
    isCompleting: false,
  };

  queue.activeExecution = activeExecution;

  if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
    correlationId,
    stage: 'processQueue-executor-call',
    actionExecutionId,
    actionId: nextAction.action.id,
    actionName: nextAction.action.name,
    screen,
    timestamp: Date.now(),
  }));

  try {
    // Execute the action using registered executor
    if (actionExecutor) {
      if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
        correlationId,
        stage: 'actionExecutor-await-start',
        actionExecutionId,
        timestamp: Date.now(),
      }));
      const completion = waitForCompletion(screen, actionExecutionId, {
        video: mediaOutputs.hasVideo,
        sound: mediaOutputs.hasSound,
        image: mediaOutputs.hasImage,
      });
      await actionExecutor(nextAction.action, nextAction.eventData, actionExecutionId);

      if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
        correlationId,
        stage: 'actionExecutor-await-done',
        actionExecutionId,
        timestamp: Date.now(),
      }));

      // Wait for actual completion via completion signal
      await completion;
    } else {
      if (overlayDebugEnabled()) console.error('[REPEAT-COMBO-QUEUE] no executor registered');
    }

    if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
      correlationId,
      stage: 'processQueue-completion',
      actionExecutionId,
      actionId: nextAction.action.id,
      actionName: nextAction.action.name,
      screen,
      queueLength: queue.queue.length,
      timestamp: Date.now(),
    }));
  } catch (error) {
    if (overlayDebugEnabled()) console.error('[REPEAT-COMBO-QUEUE] action failed', JSON.stringify({
      actionId: nextAction.action.id,
      actionName: nextAction.action.name,
      actionExecutionId: nextAction.actionExecutionId,
      screen,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
    }));
  } finally {
    queue.activeExecution = null;

    // Promote deferred combo work before processing the next item.
    promoteDeferred(screen);
    const completedAt = Date.now();
    // Process next item in queue
    if (queue.queue.length > 0) {
      if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
        correlationId,
        stage: 'processQueue-next',
        completedExecutionId: actionExecutionId,
        completionToNextStartMs: Date.now() - completedAt,
        nextExecutionId: queue.queue[0].actionExecutionId,
        nextActionId: queue.queue[0].action.id,
        screen,
        queueLength: queue.queue.length,
        timestamp: Date.now(),
      }));
      await processQueue(screen);
    } else {
      if (overlayDebugEnabled()) console.log('[TIMING-TRACE]', JSON.stringify({
        correlationId,
        stage: 'processQueue-idle',
        screen,
        timestamp: Date.now(),
      }));
    }
  }
}

/** Which media types we expect completions for. */
interface ExpectedMedia {
  video: boolean;
  sound: boolean;
  image: boolean;
}

/**
 * Wait for action completion signal from overlay widget.
 * Uses a Promise that resolves when ALL expected media completions are received.
 */
function waitForCompletion(screen: string, actionExecutionId: string, expectedMedia: ExpectedMedia): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutMs = 60000; // 60 second max wait — resolve (not reject) so queue advances
    const timeout = setTimeout(() => {
      if (overlayDebugEnabled()) console.warn('[REPEAT-COMBO-QUEUE] completion timeout — resolving to advance queue', JSON.stringify({
        actionExecutionId,
        screen,
        timestamp: Date.now(),
      }));
      removeCompletionListeners();
      resolve();
    }, timeoutMs);

    // Track which media types we're waiting for (only those that are expected)
    const waitingFor: Record<string, boolean> = {};
    if (expectedMedia.video) waitingFor.video = false;
    if (expectedMedia.sound) waitingFor.sound = false;
    if (expectedMedia.image) waitingFor.image = false;

    // If no media to wait for, resolve immediately
    if (Object.keys(waitingFor).length === 0) {
      clearTimeout(timeout);
      resolve();
      return;
    }

    function mediaCompleteHandler(event: Event) {
      const data = (event as CustomEvent).detail;
      if (data && data.type === 'media-complete' && data.screen === screen && data.actionExecutionId === actionExecutionId) {
        const mediaType = data.mediaType;
        if (waitingFor[mediaType] !== undefined) {
          waitingFor[mediaType] = true;
          if (overlayDebugEnabled()) console.log('[REPEAT-COMBO-QUEUE] media complete received', JSON.stringify({
            actionExecutionId,
            mediaType,
            waitingFor,
            allComplete: Object.values(waitingFor).every(v => v),
            timestamp: Date.now(),
          }));

          // Check if all expected media are complete
          if (Object.values(waitingFor).every(v => v)) {
            clearTimeout(timeout);
            removeCompletionListeners();
            resolve();
          }
        }
      }
    }

    // Also support legacy action-complete for backward compatibility
    function legacyCompleteHandler(event: Event) {
      const data = (event as CustomEvent).detail;
      if (data && data.type === 'action-complete' && data.screen === screen && data.actionExecutionId === actionExecutionId) {
        // Mark all as complete for legacy
        Object.keys(waitingFor).forEach(k => waitingFor[k] = true);
        clearTimeout(timeout);
        removeCompletionListeners();
        resolve();
      }
    }

    function removeCompletionListeners() {
      window.removeEventListener('rosae:media-complete', mediaCompleteHandler);
      window.removeEventListener('rosae:overlay-complete', legacyCompleteHandler);
    }

    // Listen for media-aware completion
    window.addEventListener('rosae:media-complete', mediaCompleteHandler);
    // Listen for legacy completion
    window.addEventListener('rosae:overlay-complete', legacyCompleteHandler);
  });
}

/**
 * Called by overlay widget when a media element completes.
 * Tracks per-media completion and only releases queue when ALL repeatable media are done.
 * Media types tracked: video, sound, image
 * Non-media (keystroke, minecraft, streamerbot, obs) do NOT block the queue.
 */
export function notifyMediaComplete(screen: string, actionExecutionId: string, mediaType: 'video' | 'sound' | 'image', actionId: string, actionName: string): void {
  const queue = getScreenQueue(screen);
  const activeExecution = queue.activeExecution;

  if (!activeExecution) {
    if (overlayDebugEnabled()) console.log('[REPEAT-COMBO-COMPLETION-IGNORED]', JSON.stringify({
      actionExecutionId,
      mediaType,
      reason: 'no active execution',
      screen,
      timestamp: Date.now(),
    }));
    return;
  }

  if (activeExecution.actionExecutionId !== actionExecutionId) {
    if (overlayDebugEnabled()) console.log('[REPEAT-COMBO-COMPLETION-IGNORED]', JSON.stringify({
      actionExecutionId,
      mediaType,
      reason: 'execution ID mismatch',
      activeExecutionId: activeExecution.actionExecutionId,
      screen,
      timestamp: Date.now(),
    }));
    return;
  }

  if (activeExecution.isCompleting) {
    if (overlayDebugEnabled()) console.log('[REPEAT-COMBO-COMPLETION-IGNORED]', JSON.stringify({
      actionExecutionId,
      mediaType,
      reason: 'already completing',
      screen,
      timestamp: Date.now(),
    }));
    return;
  }

  // Mark this media type as complete
  const pendingMedia = activeExecution.pendingMedia;
  const wasPending = pendingMedia[mediaType] === true;

  if (!wasPending) {
    if (overlayDebugEnabled()) console.log('[REPEAT-COMBO-COMPLETION-IGNORED]', JSON.stringify({
      actionExecutionId,
      mediaType,
      reason: 'not pending',
      pendingMedia,
      timestamp: Date.now(),
    }));
    return;
  }

  // Mark as complete
  delete pendingMedia[mediaType];

  if (overlayDebugEnabled()) console.log('[REPEAT-COMBO-COMPLETION]', JSON.stringify({
    actionExecutionId,
    mediaType,
    completedMedia: mediaType,
    pendingMedia: { ...pendingMedia },
    shouldReleaseQueue: Object.keys(pendingMedia).length === 0,
    timestamp: Date.now(),
  }));

  // Check if all repeatable media are complete
  const remainingMedia = Object.keys(pendingMedia).length;
  if (remainingMedia === 0) {
    activeExecution.isCompleting = true;
    if (overlayDebugEnabled()) console.log('[REPEAT-COMBO-QUEUE] ALL MEDIA COMPLETE - releasing queue', JSON.stringify({
      actionExecutionId,
      actionId: activeExecution.actionId,
      actionName: activeExecution.actionName,
      timestamp: Date.now(),
    }));

    // Resolve all waiting promises
    activeExecution.completionResolvers.forEach(resolve => resolve());

    // Queue will be released when processQueue continues
  }
}

/**
 * Called by overlay widget when an action completes (legacy single-completion).
 * This is kept for backward compatibility but media-aware completion is preferred.
 */
export function notifyActionComplete(screen: string, actionExecutionId: string, actionId: string, actionName: string): void {
  if (overlayDebugEnabled()) console.log('[REPEAT-COMBO-QUEUE] completion received (legacy)', JSON.stringify({
    actionId,
    actionName,
    actionExecutionId,
    screen,
    timestamp: Date.now(),
  }));

  // Broadcast to same-process queue via CustomEvent
  window.dispatchEvent(new CustomEvent('rosae:overlay-complete', {
    detail: {
      type: 'action-complete',
      screen,
      actionExecutionId,
      actionId,
      actionName,
      timestamp: Date.now(),
    }
  }));

  // Also send via BroadcastChannel for cross-context
  try {
    const ch = new BroadcastChannel('rosaefinity-overlay');
    ch.postMessage({
      type: 'action-complete',
      screen,
      actionExecutionId,
      actionId,
      actionName,
      timestamp: Date.now(),
    });
  } catch {}
}

/**
 * Get current queue status for a screen.
 */
export function getQueueStatus(screen: string): {
  queueLength: number;
  isProcessing: boolean;
  currentAction: string | null;
} {
  const queue = getScreenQueue(screen);
  return {
    queueLength: queue.queue.length,
    isProcessing: !!queue.activeExecution,
    currentAction: queue.activeExecution?.actionName || null,
  };
}

/**
 * Clear queue for a screen (e.g., on disconnect).
 */
export function clearQueue(screen: string): void {
  const queue = getScreenQueue(screen);
  const droppedCount = queue.queue.length + queue.deferred.length;
  queue.queue = [];
  queue.deferred = [];
  queue.activeExecution = null;

  if (droppedCount > 0) {
    if (overlayDebugEnabled()) console.log('[REPEAT-COMBO-QUEUE] cleared', JSON.stringify({
      screen,
      droppedCount,
      timestamp: Date.now(),
    }));
  }
}

/**
 * Peek at the next queued action's event data (without dequeueing).
 * Used by the preload system to start loading the next video before
 * the current one finishes.
 */
export function peekNextQueued(screen: string): any | null {
  const queue = getScreenQueue(screen);
  return queue.queue.length > 0 ? queue.queue[0].eventData : null;
}