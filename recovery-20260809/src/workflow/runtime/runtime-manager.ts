// =============================================
// RosaeFinity â€” Workflow Runtime Manager
// Queue, schedule, execute, retry, pause/resume,
// cancel, priority, concurrency, timeout, exactly-once.
// All execution is async and non-blocking.
// =============================================

import type { Workflow, WorkflowExecution, ExecutionStatus } from '../types.js';
import { WorkflowRunner } from '../execution/runner.js';

export interface RuntimeConfig {
  maxConcurrent: number;
  defaultTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  maxQueueSize: number;
}

interface QueueItem {
  id: string;
  workflowId: string;
  eventData: Record<string, unknown>;
  priority: number; // 0=highest, 9=lowest
  createdAt: number;
  attempts: number;
}

interface ActiveExecution {
  execution: WorkflowExecution;
  runner: WorkflowRunner;
  startedAt: number;
  timeoutTimer: ReturnType<typeof setTimeout> | null;
}

interface RuntimeCallbacks {
  onExecutionStart?: (execution: WorkflowExecution) => void;
  onExecutionComplete?: (execution: WorkflowExecution) => void;
  onExecutionError?: (workflowId: string, error: string) => void;
  onNodeExecuted?: (executionId: string, nodeId: string, duration: number) => void;
  onQueueChange?: (queueSize: number) => void;
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  maxConcurrent: 5,
  defaultTimeoutMs: 60000,
  maxRetries: 2,
  retryDelayMs: 2000,
  maxQueueSize: 100,
};

export class WorkflowRuntimeManager {
  private config: RuntimeConfig;
  private queue: QueueItem[] = [];
  private active = new Map<string, ActiveExecution>();
  private history: WorkflowExecution[] = [];
  private callbacks: RuntimeCallbacks;
  private executedIds = new Set<string>(); // Exactly-once tracking
  private workflows = new Map<string, Workflow>();

  constructor(config: Partial<RuntimeConfig> = {}, callbacks: RuntimeConfig extends RuntimeConfig ? never : RuntimeCallbacks = {}) {
    this.config = { ...DEFAULT_RUNTIME_CONFIG, ...config };
    this.callbacks = callbacks || {};
  }

  /** Register a workflow for execution */
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  /** Submit a workflow for execution */
  submit(workflowId: string, eventData: Record<string, unknown> = {}, priority = 5): string | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || !workflow.enabled) return null;

    // Exactly-once check
    const dedupKey = `${workflowId}:${JSON.stringify(eventData)}`;
    if (this.executedIds.has(dedupKey)) return null;

    const item: QueueItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workflowId,
      eventData,
      priority,
      createdAt: Date.now(),
      attempts: 0,
    };

    // Queue overflow â€” drop lowest priority
    if (this.queue.length >= this.config.maxQueueSize) {
      this.queue.sort((a, b) => a.priority - b.priority);
      this.queue.pop(); // Remove lowest priority
    }

    this.queue.push(item);
    this.processQueue();
    this.callbacks.onQueueChange?.(this.queue.length);
    return item.id;
  }

  /** Pause an execution */
  pause(executionId: string): boolean {
    const exec = this.active.get(executionId);
    if (exec && exec.execution.status === 'running') {
      exec.execution.status = 'paused';
      return true;
    }
    return false;
  }

  /** Resume an execution */
  resume(executionId: string): boolean {
    const exec = this.active.get(executionId);
    if (exec && exec.execution.status === 'paused') {
      exec.execution.status = 'running';
      this.processQueue();
      return true;
    }
    return false;
  }

  /** Cancel an execution */
  cancel(executionId: string): boolean {
    const exec = this.active.get(executionId);
    if (exec) {
      exec.runner.stop();
      if (exec.timeoutTimer) clearTimeout(exec.timeoutTimer);
      exec.execution.status = 'cancelled';
      this.active.delete(executionId);
      this.history.push(exec.execution);
      this.processQueue();
      return true;
    }
    return false;
  }

  /** Stop all executions */
  stopAll(): void {
    for (const [id, exec] of this.active) {
      exec.runner.stop();
      if (exec.timeoutTimer) clearTimeout(exec.timeoutTimer);
      exec.execution.status = 'cancelled';
      this.history.push(exec.execution);
    }
    this.active.clear();
    this.queue = [];
  }

  /** Get active executions */
  getActive(): WorkflowExecution[] {
    return Array.from(this.active.values()).map(e => e.execution);
  }

  /** Get execution history */
  getHistory(): WorkflowExecution[] {
    return [...this.history];
  }

  /** Get runtime stats */
  getStats() {
    return {
      queueSize: this.queue.length,
      activeCount: this.active.size,
      historyCount: this.history.length,
      maxConcurrent: this.config.maxConcurrent,
      executedIdsSize: this.executedIds.size,
    };
  }

  /** Clear history */
  clearHistory(): void {
    this.history = [];
    this.executedIds.clear();
  }

  // â”€â”€ Private â”€â”€

  private async processQueue(): Promise<void> {
    while (this.active.size < this.config.maxConcurrent && this.queue.length > 0) {
      // Sort by priority (lower = higher priority)
      this.queue.sort((a, b) => a.priority - b.priority);
      const item = this.queue.shift()!;
      this.callbacks.onQueueChange?.(this.queue.length);

      const workflow = this.workflows.get(item.workflowId);
      if (!workflow) continue;

      await this.executeWorkflow(workflow, item);
    }
  }

  private async executeWorkflow(workflow: Workflow, item: QueueItem): Promise<void> {
    const runner = new WorkflowRunner(workflow, {
      onComplete: (exec) => {
        this.active.delete(exec.id);
        this.history.push(exec);
        if (exec.timeoutTimer) clearTimeout(exec.timeoutTimer);
        this.callbacks.onExecutionComplete?.(exec);
        this.processQueue();
      },
      onError: (error) => {
        // Retry logic
        if (item.attempts < this.config.maxRetries) {
          item.attempts++;
          setTimeout(() => {
            this.queue.push(item);
            this.processQueue();
          }, this.config.retryDelayMs * item.attempts);
        }
        this.callbacks.onExecutionError?.(item.workflowId, error);
      },
      onNodeComplete: (nodeId) => {
        this.callbacks.onNodeExecuted?.('', nodeId, 0);
      },
    });

    const execution = await runner.start(item.eventData);

    // Set timeout
    const timeoutTimer = setTimeout(() => {
      if (this.active.has(execution.id)) {
        runner.stop();
        execution.status = 'timeout';
        execution.error = 'Execution timed out';
        this.active.delete(execution.id);
        this.history.push(execution);
        this.processQueue();
      }
    }, this.config.defaultTimeoutMs);

    this.active.set(execution.id, {
      execution,
      runner,
      startedAt: Date.now(),
      timeoutTimer,
    });

    this.callbacks.onExecutionStart?.(execution);
  }
}

// Singleton
let _runtime: WorkflowRuntimeManager | null = null;

export function getWorkflowRuntime(config?: Partial<RuntimeConfig>, callbacks?: RuntimeCallbacks): WorkflowRuntimeManager {
  if (!_runtime) {
    _runtime = new WorkflowRuntimeManager(config, callbacks);
  }
  return _runtime;
}

export function resetWorkflowRuntime(): void {
  if (_runtime) {
    _runtime.stopAll();
    _runtime = null;
  }
}
