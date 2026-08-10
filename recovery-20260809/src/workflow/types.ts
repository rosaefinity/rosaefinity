// =============================================
// RosaeFinity â€” Workflow Types
// Complete type system for the workflow engine.
// =============================================

// â”€â”€ Trigger Types â”€â”€
export type TriggerType =
  | 'gift' | 'gift-combo' | 'like' | 'follow' | 'share'
  | 'comment' | 'join' | 'viewer-count' | 'goal-complete'
  | 'manual' | 'hotkey' | 'timer' | 'schedule'
  | 'app-startup' | 'workflow-complete';

// â”€â”€ Node Types â”€â”€
export type NodeType =
  | 'start' | 'end'
  | 'condition' | 'delay' | 'wait' | 'random' | 'probability'
  | 'counter' | 'loop' | 'switch' | 'variable' | 'math' | 'text'
  | 'notification' | 'sound' | 'video' | 'image'
  | 'obs-command' | 'overlay' | 'browser-source' | 'keystroke'
  | 'webhook' | 'http-request' | 'run-workflow' | 'stop-workflow';

// â”€â”€ Condition Operators â”€â”€
export type ConditionOperator =
  | 'equals' | 'not-equals'
  | 'greater-than' | 'less-than' | 'greater-equal' | 'less-equal'
  | 'contains' | 'starts-with' | 'ends-with' | 'regex'
  | 'and' | 'or' | 'not';

// â”€â”€ Workflow â”€â”€
export interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  variables: WorkflowVariable[];
  metadata: WorkflowMetadata;
  version: number;
  createdAt: number;
  updatedAt: number;
}

// â”€â”€ Trigger â”€â”€
export interface WorkflowTrigger {
  type: TriggerType;
  config: Record<string, unknown>;
}

// â”€â”€ Node â”€â”€
export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  width?: number;
  height?: number;
}

// â”€â”€ Connection â”€â”€
export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  sourceOutput: string; // 'out' | 'true' | 'false' | output index
  targetNodeId: string;
  targetInput: string;
  label?: string;
}

// â”€â”€ Variable â”€â”€
export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  defaultValue: unknown;
  scope: 'global' | 'workflow' | 'temp';
  description?: string;
}

// â”€â”€ Metadata â”€â”€
export interface WorkflowMetadata {
  author: string;
  tags: string[];
  folder?: string;
  lastExecutedAt?: number;
  executionCount: number;
  avgExecutionTimeMs: number;
  errorCount: number;
}

// â”€â”€ Execution State â”€â”€
export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  currentNodeId: string | null;
  variables: Record<string, unknown>;
  startedAt: number;
  completedAt: number | null;
  elapsedMs: number;
  logs: ExecutionLog[];
  error: string | null;
}

export interface ExecutionLog {
  timestamp: number;
  nodeId: string;
  nodeType: NodeType;
  message: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  variables?: Record<string, unknown>;
}

// â”€â”€ Node Definition (for registry) â”€â”€
export interface NodeDefinition {
  type: NodeType;
  label: string;
  category: string;
  icon: string;
  description: string;
  inputs: NodePort[];
  outputs: NodePort[];
  defaultConfig: Record<string, unknown>;
}

export interface NodePort {
  id: string;
  label: string;
  type: 'any' | 'number' | 'string' | 'boolean';
  multiple?: boolean;
}

// â”€â”€ Built-in Variables â”€â”€
export const BUILTIN_VARIABLES: Record<string, unknown> = {
  username: '',
  giftName: '',
  giftCount: 0,
  combo: 0,
  coins: 0,
  viewerCount: 0,
  likeCount: 0,
  shareCount: 0,
  comment: '',
  roomId: '',
  country: '',
  timestamp: 0,
};

// â”€â”€ Node Categories â”€â”€
export const NODE_CATEGORIES = [
  'Flow',
  'Logic',
  'Data',
  'Actions',
  'Integrations',
  'Media',
] as const;
