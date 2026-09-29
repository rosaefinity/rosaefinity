// ═══════════════════════════════════════════════════════════════════
// Action Execution Queue — Sequential FIFO per screen
// Handles repeat combo: one action at a time per screen, queue others
// Media-aware: tracks video/sound/image completion per action execution
// ═══════════════════════════════════════════════════════════════════

import type { Action } from '../types';

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
  activeExecution: ActiveExecution | null;
}

const screenQueues: Map<string, ScreenQueue> = new Map();
const MAX_QUEUE_LENGTH = 100; // configurable limit

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
function getActionMediaOutputs(action: Action): {
  hasVideo: boolean;
  hasSound: boolean;
  hasImage: boolean;
  hasKeystroke: boolean;
  hasMinecraft: boolean;
  hasStreamerbot: boolean;
  hasObs: boolean;
} {
  return {
    hasVideo: action.video && !!(action.videoFile || action.videoFileName),
    hasSound: action.sound && !!(action.soundFile || action.soundFileName),
    hasImage: action.image && !!(action.imageFile || action.imageFileName),
    hasKeystroke: action.keystroke && !!action.keystrokeKeys,
    hasMinecraft: action.minecraft && !!action.minecraftCommand,
    hasStreamerbot: false, // streamerbot doesn't produce overlay media
    hasObs: false, // OBS scene switch doesn't produce overlay media
  };
}

/**
 * Enqueue an action for execution on a specific screen.
 * Returns true if enqueued, false if queue is full.
 */
export function enqueueAction(screen: string, action: Action, eventData: any, actionExecutionId?: string): boolean {
  const queue = getScreenQueue(screen);

  if (queue.queue.length >= MAX_QUEUE_LENGTH) {
    console.warn('[REPEAT-COMBO-QUEUE] queue full, dropping action', JSON.stringify({
      actionId: action.id,
      actionName: action.name,
      screen,
      queueLength: queue.queue.length,
      maxQueueLength: MAX_QUEUE_LENGTH,
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

  queue.queue.push(queuedAction);

  console.log('[ACTION-ENQUEUED]', JSON.stringify({
    executionId: executionId,
    actionId: action.id,
    actionName: action.name,
    screen,
    queueLength: queue.queue.length,
    hasActivePlayback: !!queue.activeExecution,
    timestamp: Date.now(),
  }));

  // Try to process if not already processing
  processQueue(screen);

  return true;
}

/**
 * Process the queue for a screen. Only runs if not currently processing.
 */
async function processQueue(screen: string): Promise<void> {
  const queue = getScreenQueue(screen);

  if (queue.activeExecution) {
    console.log('[REPEAT-COMBO-QUEUE] EXECUTION BLOCKED', JSON.stringify({
      incomingExecutionId: queue.queue[0]?.actionExecutionId || null,
      activeExecutionId: queue.activeExecution?.actionExecutionId || null,
      queueLength: queue.queue.length,
      isProcessing: !!queue.activeExecution,
      timestamp: Date.now(),
    }));
    return;
  }

  if (queue.queue.length === 0) {
    return;
  }

  const nextAction = queue.queue.shift()!;
  const actionExecutionId = nextAction.actionExecutionId;
  const mediaOutputs = getActionMediaOutputs(nextAction.action);

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

  console.log('[ACTION-STARTED]', JSON.stringify({
    executionId: actionExecutionId,
    actionId: nextAction.action.id,
    actionName: nextAction.action.name,
    screen,
    queueLength: queue.queue.length,
    timestamp: Date.now(),
  }));

  try {
    // Execute the action using registered executor
    if (actionExecutor) {
      console.log('[REPEAT-COMBO-QUEUE] WAITING FOR COMPLETION', JSON.stringify({
        executionId: actionExecutionId,
        pendingMedia,
        timestamp: Date.now(),
      }));
      await actionExecutor(nextAction.action, nextAction.eventData, actionExecutionId);

      // Wait for actual completion via completion signal
      await waitForCompletion(screen, actionExecutionId, {
        video: mediaOutputs.hasVideo,
        sound: mediaOutputs.hasSound,
        image: mediaOutputs.hasImage,
      });
    } else {
      console.error('[REPEAT-COMBO-QUEUE] no executor registered');
    }

    console.log('[REPEAT-COMBO-QUEUE] COMPLETION RECEIVED', JSON.stringify({
      completionExecutionId: actionExecutionId,
      activeExecutionId: queue.activeExecution?.actionExecutionId || null,
      matched: true,
      timestamp: Date.now(),
    }));

    console.log('[ACTION-FINISHED]', JSON.stringify({
      executionId: actionExecutionId,
      actionId: nextAction.action.id,
      actionName: nextAction.action.name,
      screen,
      queueLength: queue.queue.length,
      timestamp: Date.now(),
    }));
  } catch (error) {
    console.error('[REPEAT-COMBO-QUEUE] action failed', JSON.stringify({
      actionId: nextAction.action.id,
      actionName: nextAction.action.name,
      actionExecutionId: nextAction.actionExecutionId,
      screen,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
    }));
  } finally {
    queue.activeExecution = null;

    // Process next item in queue
    if (queue.queue.length > 0) {
      console.log('[NEXT-DEQUEUED]', JSON.stringify({
        completedExecutionId: actionExecutionId,
        nextExecutionId: queue.queue[0].actionExecutionId,
        nextActionId: queue.queue[0].action.id,
        screen,
        queueLength: queue.queue.length,
        timestamp: Date.now(),
      }));
      await processQueue(screen);
    } else {
      console.log('[QUEUE-IDLE]', JSON.stringify({
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
      console.warn('[REPEAT-COMBO-QUEUE] completion timeout — resolving to advance queue', JSON.stringify({
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
          console.log('[REPEAT-COMBO-QUEUE] media complete received', JSON.stringify({
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
    console.log('[REPEAT-COMBO-COMPLETION-IGNORED]', JSON.stringify({
      actionExecutionId,
      mediaType,
      reason: 'no active execution',
      screen,
      timestamp: Date.now(),
    }));
    return;
  }

  if (activeExecution.actionExecutionId !== actionExecutionId) {
    console.log('[REPEAT-COMBO-COMPLETION-IGNORED]', JSON.stringify({
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
    console.log('[REPEAT-COMBO-COMPLETION-IGNORED]', JSON.stringify({
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
    console.log('[REPEAT-COMBO-COMPLETION-IGNORED]', JSON.stringify({
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

  console.log('[REPEAT-COMBO-COMPLETION]', JSON.stringify({
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
    console.log('[REPEAT-COMBO-QUEUE] ALL MEDIA COMPLETE - releasing queue', JSON.stringify({
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
  console.log('[REPEAT-COMBO-QUEUE] completion received (legacy)', JSON.stringify({
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
  const droppedCount = queue.queue.length;
  queue.queue = [];
  queue.activeExecution = null;

  if (droppedCount > 0) {
    console.log('[REPEAT-COMBO-QUEUE] cleared', JSON.stringify({
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