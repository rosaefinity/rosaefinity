// =============================================
// RosaeFinity â€” Workflow Runtime
// Connects TikTokEngine â†’ EventPipeline â†’ WorkflowEngine.
// Central integration point for all systems.
// =============================================

import { getTikTokEngine } from '../../engine/tiktok/tiktok-engine.js';
import { getWorkflowEngine } from '../engine/workflow-engine.js';
import { getWorkflowRuntime } from './runtime-manager.js';
import { extractVariables, extractComboVariables } from './variable-bindings.js';
import type { TikTokEvent } from '../../engine/tiktok/types.js';
import type { GiftCombo } from '../../engine/tiktok/types.js';
import type { WorkflowExecution } from '../types.js';

// â”€â”€ Trigger â†’ Workflow Mapping â”€â”€
const TRIGGER_MAP: Record<string, string[]> = {};

interface RuntimeCallbacks {
  onExecutionStart?: (execution: WorkflowExecution) => void;
  onExecutionComplete?: (execution: WorkflowExecution) => void;
  onExecutionError?: (workflowId: string, error: string) => void;
}

let initialized = false;

/** Initialize the workflow runtime â€” connects all systems */
export function initWorkflowRuntime(callbacks: RuntimeCallbacks = {}): void {
  if (initialized) return;
  initialized = true;

  const runtime = getWorkflowRuntime({
    maxConcurrent: 5,
    defaultTimeoutMs: 30000,
    maxRetries: 2,
  }, {
    onExecutionStart: callbacks.onExecutionStart,
    onExecutionComplete: callbacks.onExecutionComplete,
    onExecutionError: callbacks.onExecutionError,
  });

  // â”€â”€ Hook into TikTokEngine events â”€â”€
  const tiktokEngine = getTikTokEngine();
  tiktokEngine.initialize({
    onEvent: (event: TikTokEvent) => {
      // Trigger matching workflows
      triggerWorkflows(event.type, extractVariables(event));
    },
    onComboStart: (combo: GiftCombo) => {
      triggerWorkflows('gift-combo', extractComboVariables(combo));
    },
  });

  // â”€â”€ Hook into gift combo engine â”€â”€
  // The combo events are already routed through TikTokEngine
}

/** Trigger workflows for a given event type */
function triggerWorkflows(eventType: string, variables: Record<string, unknown>): void {
  const engine = getWorkflowEngine();
  const runtime = getWorkflowRuntime();

  // Find all workflows with matching trigger
  const workflows = engine.getAllWorkflows().filter(w =>
    w.enabled && w.trigger.type === eventType
  );

  for (const workflow of workflows) {
    // Register with runtime if not already
    runtime.registerWorkflow(workflow);

    // Priority based on event type
    const priority = getPriority(eventType);

    // Submit for execution (async, non-blocking)
    runtime.submit(workflow.id, variables, priority);
  }
}

/** Map event type to priority */
function getPriority(eventType: string): number {
  const priorities: Record<string, number> = {
    'gift': 1,
    'gift-combo': 1,
    'subscribe': 1,
    'follow': 3,
    'share': 3,
    'join': 4,
    'comment': 5,
    'like': 6,
    'viewer-count': 8,
    'goal-complete': 0,
    'manual': 0,
  };
  return priorities[eventType] ?? 5;
}

/** Manually trigger a workflow */
export function triggerManualWorkflow(workflowId: string, data: Record<string, unknown> = {}): void {
  const runtime = getWorkflowRuntime();
  runtime.submit(workflowId, data, 0); // Highest priority for manual
}

/** Get runtime stats */
export function getWorkflowRuntimeStats() {
  return getWorkflowRuntime().getStats();
}

/** Get active executions */
export function getActiveWorkflowExecutions() {
  return getWorkflowRuntime().getActive();
}

/** Get execution history */
export function getWorkflowExecutionHistory() {
  return getWorkflowRuntime().getHistory();
}

/** Stop all workflows */
export function stopAllWorkflows(): void {
  getWorkflowRuntime().stopAll();
}
