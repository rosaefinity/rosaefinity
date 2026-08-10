// =============================================
// RosaeFinity â€” Workflow Engine
// Singleton orchestrator for all workflows.
// =============================================

import type { Workflow, WorkflowExecution, WorkflowMetadata } from '../types';
import { WorkflowRunner } from '../execution/runner.js';

interface EngineCallbacks {
  onWorkflowStart?: (execution: WorkflowExecution) => void;
  onWorkflowComplete?: (execution: WorkflowExecution) => void;
  onWorkflowError?: (workflowId: string, error: string) => void;
}

class WorkflowEngineImpl {
  private workflows = new Map<string, Workflow>();
  private running = new Map<string, WorkflowRunner>();
  private queue: { workflowId: string; eventData: Record<string, unknown> }[] = [];
  private callbacks: EngineCallbacks = {};
  private maxConcurrent = 5;
  private initialized = false;

  /** Initialize the engine */
  initialize(callbacks: EngineCallbacks = {}): void {
    if (this.initialized) return;
    this.callbacks = callbacks;
    this.initialized = true;
  }

  /** Register a workflow */
  register(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  /** Unregister a workflow */
  unregister(workflowId: string): void {
    this.workflows.delete(workflowId);
  }

  /** Get a workflow */
  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  /** Get all workflows */
  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /** Execute a workflow */
  async execute(workflowId: string, eventData: Record<string, unknown> = {}): Promise<WorkflowExecution | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || !workflow.enabled) return null;

    // Check concurrency limit
    if (this.running.size >= this.maxConcurrent) {
      this.queue.push({ workflowId, eventData });
      return null;
    }

    const runner = new WorkflowRunner(workflow, {
      onComplete: (exec) => {
        this.running.delete(workflowId);
        this.callbacks.onWorkflowComplete?.(exec);
        this.processQueue();
      },
      onError: (error) => {
        this.running.delete(workflowId);
        this.callbacks.onWorkflowError?.(workflowId, error);
        this.processQueue();
      },
    });

    this.running.set(workflowId, runner);
    const execution = await runner.start(eventData);
    this.callbacks.onWorkflowStart?.(execution);
    return execution;
  }

  /** Stop a running workflow */
  stop(workflowId: string): void {
    const runner = this.running.get(workflowId);
    if (runner) {
      runner.stop();
      this.running.delete(workflowId);
    }
  }

  /** Stop all workflows */
  stopAll(): void {
    for (const [id, runner] of this.running) {
      runner.stop();
    }
    this.running.clear();
    this.queue = [];
  }

  /** Get running workflows */
  getRunning(): string[] {
    return Array.from(this.running.keys());
  }

  /** Get queue size */
  getQueueSize(): number {
    return this.queue.length;
  }

  /** Get engine stats */
  getStats() {
    return {
      totalWorkflows: this.workflows.size,
      enabledWorkflows: Array.from(this.workflows.values()).filter(w => w.enabled).length,
      runningCount: this.running.size,
      queueSize: this.queue.length,
    };
  }

  /** Import workflow from JSON */
  importWorkflow(json: string): Workflow | null {
    try {
      const workflow = JSON.parse(json) as Workflow;
      if (!workflow.id || !workflow.nodes) return null;
      workflow.updatedAt = Date.now();
      this.register(workflow);
      return workflow;
    } catch {
      return null;
    }
  }

  /** Export workflow to JSON */
  exportWorkflow(workflowId: string): string | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;
    return JSON.stringify(workflow, null, 2);
  }

  /** Load workflows from storage */
  loadFromStorage(key: string): void {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const workflows: Workflow[] = JSON.parse(raw);
        for (const w of workflows) {
          this.workflows.set(w.id, w);
        }
      }
    } catch {}
  }

  /** Save workflows to storage */
  saveToStorage(key: string): void {
    try {
      const workflows = Array.from(this.workflows.values());
      localStorage.setItem(key, JSON.stringify(workflows));
    } catch {}
  }

  // â”€â”€ Private â”€â”€

  private processQueue(): void {
    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      const { workflowId, eventData } = this.queue.shift()!;
      this.execute(workflowId, eventData);
    }
  }
}

// Singleton
let _engine: WorkflowEngineImpl | null = null;

export function getWorkflowEngine(): WorkflowEngineImpl {
  if (!_engine) _engine = new WorkflowEngineImpl();
  return _engine;
}

export function resetWorkflowEngine(): void {
  if (_engine) {
    _engine.stopAll();
    _engine = null;
  }
}
