// =============================================
// RosaeFinity â€” Workflow Execution Runner
// Async execution with pause/resume/stop/retry.
// =============================================

import type { Workflow, WorkflowNode, WorkflowExecution, ExecutionLog, ExecutionStatus } from '../types';
import { VariableManager } from '../variables/manager.js';
import { evaluateCondition } from '../conditions/engine.js';

interface RunnerCallbacks {
  onNodeStart?: (nodeId: string) => void;
  onNodeComplete?: (nodeId: string) => void;
  onNodeError?: (nodeId: string, error: string) => void;
  onVariableChange?: (name: string, value: unknown) => void;
  onLog?: (log: ExecutionLog) => void;
  onComplete?: (execution: WorkflowExecution) => void;
  onError?: (error: string) => void;
}

export class WorkflowRunner {
  private execution: WorkflowExecution;
  private workflow: Workflow;
  private vars: VariableManager;
  private callbacks: RunnerCallbacks;
  private abortController: AbortController | null = null;

  constructor(workflow: Workflow, callbacks: RunnerCallbacks = {}) {
    this.workflow = workflow;
    this.callbacks = callbacks;
    this.vars = new VariableManager();
    this.execution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      workflowId: workflow.id,
      status: 'idle',
      currentNodeId: null,
      variables: {},
      startedAt: 0,
      completedAt: null,
      elapsedMs: 0,
      logs: [],
      error: null,
    };
  }

  /** Start execution */
  async start(eventData: Record<string, unknown> = {}): Promise<WorkflowExecution> {
    this.execution.status = 'running';
    this.execution.startedAt = Date.now();
    this.abortController = new AbortController();

    // Initialize variables
    this.vars.initWorkflow(this.workflow.variables);
    for (const [k, v] of Object.entries(eventData)) {
      this.vars.set(k, v, 'temp');
    }

    // Find start node
    const startNode = this.workflow.nodes.find(n => n.type === 'start');
    if (!startNode) {
      return this.fail('No start node found');
    }

    try {
      await this.executeNode(startNode.id);
      this.execution.status = 'completed';
      this.execution.completedAt = Date.now();
      this.execution.elapsedMs = this.execution.completedAt - this.execution.startedAt;
      this.callbacks.onComplete?.(this.execution);
    } catch (err: any) {
      if (err.message === 'CANCELLED') {
        this.execution.status = 'cancelled';
      } else if (err.message === 'TIMEOUT') {
        this.execution.status = 'timeout';
      } else {
        return this.fail(err.message);
      }
    }

    return this.execution;
  }

  /** Stop execution */
  stop(): void {
    this.abortController?.abort();
    this.execution.status = 'cancelled';
  }

  /** Get current execution state */
  getExecution(): WorkflowExecution {
    return { ...this.execution, variables: this.vars.getAll() };
  }

  // â”€â”€ Private: Node Execution â”€â”€

  private async executeNode(nodeId: string): Promise<void> {
    if (this.abortController?.signal.aborted) throw new Error('CANCELLED');

    const node = this.workflow.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    this.execution.currentNodeId = nodeId;
    this.callbacks.onNodeStart?.(nodeId);

    try {
      const output = await this.runNode(node);
      this.callbacks.onNodeComplete?.(nodeId);

      // Find next node(s) from connections
      const connections = this.workflow.connections.filter(c => c.sourceNodeId === nodeId);
      const outputKey = output || 'out';
      const matchingConnections = connections.filter(c => c.sourceOutput === outputKey);

      for (const conn of matchingConnections) {
        await this.executeNode(conn.targetNodeId);
      }
    } catch (err: any) {
      this.callbacks.onNodeError?.(nodeId, err.message);
      throw err;
    }
  }

  private async runNode(node: WorkflowNode): Promise<string | undefined> {
    const { type, config } = node;

    switch (type) {
      case 'start':
        return 'out';

      case 'end':
        return undefined;

      case 'delay':
        await this.delay(config.durationMs as number || 1000);
        return 'out';

      case 'condition': {
        const cond = config.condition as any;
        const result = evaluateCondition(cond, this.vars.getAll());
        return result ? 'true' : 'false';
      }

      case 'switch': {
        const varName = config.variable as string;
        const value = this.vars.get(varName);
        const cases = (config.cases as any[]) || [];
        for (let i = 0; i < cases.length; i++) {
          if (value === cases[i].value) return `case-${i}`;
        }
        return 'default';
      }

      case 'random':
        return Math.random() * 100 < (config.probability as number || 50) ? 'success' : 'fail';

      case 'probability':
        return Math.random() * 100 < (config.percent as number || 50) ? 'success' : 'fail';

      case 'loop': {
        const count = config.count as number || 1;
        const loopVar = config.variable as string || '_loopIndex';
        for (let i = 0; i < count; i++) {
          this.vars.set(loopVar, i, 'temp');
          const connections = this.workflow.connections.filter(c => c.sourceNodeId === node.id && c.sourceOutput === 'body');
          for (const conn of connections) {
            await this.executeNode(conn.targetNodeId);
          }
        }
        return 'done';
      }

      case 'counter': {
        const counterVar = config.variable as string || '_counter';
        const current = Number(this.vars.get(counterVar) || 0);
        this.vars.set(counterVar, current + (config.increment as number || 1), 'workflow');
        return 'out';
      }

      case 'variable': {
        const varName = config.variable as string;
        const value = config.value;
        const scope = (config.scope as any) || 'workflow';
        this.vars.set(varName, value, scope);
        this.callbacks.onVariableChange?.(varName, value);
        return 'out';
      }

      case 'math': {
        const op = config.operation as string;
        const a = Number(config.operand1 || 0);
        const b = Number(config.operand2 || 0);
        let result = 0;
        switch (op) {
          case 'add': result = a + b; break;
          case 'subtract': result = a - b; break;
          case 'multiply': result = a * b; break;
          case 'divide': result = b !== 0 ? a / b : 0; break;
          case 'modulo': result = b !== 0 ? a % b : 0; break;
        }
        this.vars.set(config.resultVariable as string || '_mathResult', result, 'temp');
        return 'out';
      }

      case 'text': {
        const op = config.operation as string;
        const t1 = String(config.text1 || '');
        const t2 = String(config.text2 || '');
        let result = '';
        switch (op) {
          case 'concat': result = t1 + t2; break;
          case 'uppercase': result = t1.toUpperCase(); break;
          case 'lowercase': result = t1.toLowerCase(); break;
          case 'trim': result = t1.trim(); break;
          case 'length': result = String(t1.length); break;
        }
        result = this.vars.interpolate(result);
        this.vars.set(config.resultVariable as string || '_textResult', result, 'temp');
        return 'out';
      }

      case 'notification': {
        // Dispatch notification event
        const title = this.vars.interpolate(String(config.title || ''));
        const message = this.vars.interpolate(String(config.message || ''));
        window.dispatchEvent(new CustomEvent('rosae:notification', {
          detail: { type: config.type || 'info', title, message, duration: config.duration || 4000 },
        }));
        return 'out';
      }

      default:
        // Unknown node type â€” pass through
        return 'out';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      this.abortController?.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('CANCELLED'));
      });
    });
  }

  private fail(message: string): WorkflowExecution {
    this.execution.status = 'failed';
    this.execution.error = message;
    this.execution.completedAt = Date.now();
    this.execution.elapsedMs = this.execution.completedAt - this.execution.startedAt;
    this.addLog('error', 'system', 'start', message);
    this.callbacks.onError?.(message);
    return this.execution;
  }

  private addLog(level: ExecutionLog['level'], nodeId: string, nodeType: string, message: string): void {
    const log: ExecutionLog = {
      timestamp: Date.now(),
      nodeId,
      nodeType: nodeType as any,
      message,
      level,
      variables: this.vars.getAll(),
    };
    this.execution.logs.push(log);
    this.callbacks.onLog?.(log);
  }
}
