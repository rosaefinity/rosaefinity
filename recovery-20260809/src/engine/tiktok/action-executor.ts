// =============================================
// RosaeFinity â€” Action Executor
// Exactly-once execution, ordering, timeout,
// retry, cancellation, queue inspection.
// =============================================

import type { TikTokEvent, ActionExecution } from './types';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface ExecutorConfig {
  maxConcurrent: number;
  defaultTimeoutMs: number;
  defaultMaxRetries: number;
  retryDelayMs: number;
}

const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  maxConcurrent: 3,
  defaultTimeoutMs: 10000,
  defaultMaxRetries: 2,
  retryDelayMs: 1000,
};

interface ActionHandler {
  (event: TikTokEvent): Promise<void>;
}

export class ActionExecutor {
  private config: ExecutorConfig;
  private queue: ActionExecution[] = [];
  private running = new Map<string, ActionExecution>();
  private handlers = new Map<string, ActionHandler>();
  private executedIds = new Set<string>(); // For exactly-once
  private stats = { executed: 0, failed: 0, timedOut: 0, cancelled: 0 };

  constructor(config: Partial<ExecutorConfig> = {}) {
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
  }

  /** Register an action handler for an event type */
  register(eventType: string, handler: ActionHandler): void {
    this.handlers.set(eventType, handler);
  }

  /** Submit an event for action execution */
  async submit(event: TikTokEvent, actionId?: string): Promise<string> {
    const execId = generateId();

    // Exactly-once check
    const dedupKey = `${event.type}:${JSON.stringify(event.data)}`;
    if (this.executedIds.has(dedupKey)) {
      return ''; // Already executed
    }

    const execution: ActionExecution = {
      id: execId,
      actionId: actionId || event.type,
      event,
      status: 'queued',
      startedAt: null,
      completedAt: null,
      error: null,
      retryCount: 0,
      maxRetries: this.config.defaultMaxRetries,
      timeoutMs: this.config.defaultTimeoutMs,
    };

    this.queue.push(execution);
    this.processQueue();

    return execId;
  }

  /** Cancel an execution */
  cancel(executionId: string): void {
    const exec = this.queue.find(e => e.id === executionId) || this.running.get(executionId);
    if (exec) {
      exec.status = 'cancelled';
      this.stats.cancelled++;
      this.queue = this.queue.filter(e => e.id !== executionId);
      this.running.delete(executionId);
    }
  }

  /** Get queue inspection */
  getQueue(): ActionExecution[] {
    return [...this.queue, ...Array.from(this.running.values())];
  }

  /** Get execution by ID */
  getExecution(id: string): ActionExecution | undefined {
    return this.queue.find(e => e.id === id) || this.running.get(id);
  }

  /** Get stats */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      runningCount: this.running.size,
      executedIdsSize: this.executedIds.size,
    };
  }

  /** Clear executed history */
  clearHistory(): void {
    this.executedIds.clear();
  }

  // â”€â”€ Private â”€â”€

  private async processQueue(): Promise<void> {
    while (this.running.size < this.config.maxConcurrent && this.queue.length > 0) {
      const execution = this.queue.shift()!;
      if (execution.status === 'cancelled') continue;

      this.running.set(execution.id, execution);
      this.executeWithTimeout(execution).catch(() => {});
    }
  }

  private async executeWithTimeout(execution: ActionExecution): Promise<void> {
    execution.status = 'running';
    execution.startedAt = Date.now();

    const handler = this.handlers.get(execution.event.type);
    if (!handler) {
      execution.status = 'failed';
      execution.error = `No handler for event type: ${execution.event.type}`;
      this.stats.failed++;
      this.running.delete(execution.id);
      this.processQueue();
      return;
    }

    try {
      // Execute with timeout
      await Promise.race([
        handler(execution.event),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), execution.timeoutMs)
        ),
      ]);

      // Success
      execution.status = 'completed';
      execution.completedAt = Date.now();
      this.stats.executed++;

      // Mark as executed (exactly-once)
      const dedupKey = `${execution.event.type}:${JSON.stringify(execution.event.data)}`;
      this.executedIds.add(dedupKey);
    } catch (err: any) {
      if (err.message === 'Timeout') {
        execution.status = 'timeout';
        this.stats.timedOut++;
      } else {
        execution.error = err.message;

        // Retry
        if (execution.retryCount < execution.maxRetries) {
          execution.retryCount++;
          execution.status = 'queued';
          this.running.delete(execution.id);
          setTimeout(() => this.processQueue(), this.config.retryDelayMs * execution.retryCount);
          return;
        }

        execution.status = 'failed';
        this.stats.failed++;
      }
    } finally {
      this.running.delete(execution.id);
      this.processQueue();
    }
  }
}
