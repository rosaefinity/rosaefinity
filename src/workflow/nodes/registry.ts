// =============================================
// RosaeFinity — Node Registry
// All node definitions with ports and configs.
// =============================================

import type { NodeDefinition } from '../types';

const NODES: NodeDefinition[] = [
  // ── Flow ──
  {
    type: 'start', label: 'Start', category: 'Flow', icon: '▶',
    description: 'Workflow entry point',
    inputs: [], outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: {},
  },
  {
    type: 'end', label: 'End', category: 'Flow', icon: '⏹',
    description: 'Workflow exit point',
    inputs: [{ id: 'in', label: '', type: 'any' }], outputs: [],
    defaultConfig: {},
  },
  {
    type: 'delay', label: 'Delay', category: 'Flow', icon: '⏱',
    description: 'Wait for a specified duration',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { durationMs: 1000 },
  },
  {
    type: 'wait', label: 'Wait For', category: 'Flow', icon: '⏳',
    description: 'Wait until a condition is met',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }, { id: 'timeout', label: 'Timeout', type: 'any' }],
    defaultConfig: { variable: '', expectedValue: '', timeoutMs: 30000 },
  },

  // ── Logic ──
  {
    type: 'condition', label: 'Condition', category: 'Logic', icon: '❓',
    description: 'Branch based on a condition',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'true', label: 'True', type: 'any' }, { id: 'false', label: 'False', type: 'any' }],
    defaultConfig: { condition: { operator: 'equals', left: '', right: '' } },
  },
  {
    type: 'switch', label: 'Switch', category: 'Logic', icon: '🔀',
    description: 'Multi-branch based on value',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'case-0', label: 'Case 1', type: 'any' }, { id: 'default', label: 'Default', type: 'any' }],
    defaultConfig: { variable: '', cases: [] },
  },
  {
    type: 'random', label: 'Random', category: 'Logic', icon: '🎲',
    description: 'Random branch',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'a', label: 'A', type: 'any' }, { id: 'b', label: 'B', type: 'any' }],
    defaultConfig: { probability: 50 },
  },
  {
    type: 'probability', label: 'Probability', category: 'Logic', icon: '%',
    description: 'Execute with probability',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'success', label: 'Success', type: 'any' }, { id: 'fail', label: 'Fail', type: 'any' }],
    defaultConfig: { percent: 50 },
  },
  {
    type: 'loop', label: 'Loop', category: 'Logic', icon: '🔄',
    description: 'Repeat N times',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'body', label: 'Body', type: 'any' }, { id: 'done', label: 'Done', type: 'any' }],
    defaultConfig: { count: 3, variable: '_loopIndex' },
  },
  {
    type: 'counter', label: 'Counter', category: 'Logic', icon: '#',
    description: 'Increment a counter',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { variable: '_counter', increment: 1, resetAt: 0 },
  },

  // ── Data ──
  {
    type: 'variable', label: 'Set Variable', category: 'Data', icon: '📝',
    description: 'Set a variable value',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { variable: '', value: '', scope: 'workflow' },
  },
  {
    type: 'math', label: 'Math', category: 'Data', icon: '🔢',
    description: 'Perform math operation',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { operation: 'add', operand1: 0, operand2: 0, resultVariable: '_mathResult' },
  },
  {
    type: 'text', label: 'Text', category: 'Data', icon: '💬',
    description: 'Text operations',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { operation: 'concat', text1: '', text2: '', resultVariable: '_textResult' },
  },

  // ── Actions ──
  {
    type: 'notification', label: 'Notification', category: 'Actions', icon: '🔔',
    description: 'Show a notification',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { title: 'Alert', message: '', type: 'info', duration: 4000 },
  },
  {
    type: 'sound', label: 'Play Sound', category: 'Actions', icon: '🔊',
    description: 'Play a sound effect',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { soundId: '', volume: 100 },
  },
  {
    type: 'video', label: 'Show Video', category: 'Actions', icon: '🎬',
    description: 'Display a video overlay',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { videoId: '', duration: 5000, screen: '1' },
  },
  {
    type: 'image', label: 'Show Image', category: 'Actions', icon: '🖼',
    description: 'Display an image overlay',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { imageId: '', duration: 5000, screen: '1' },
  },
  {
    type: 'keystroke', label: 'Keystroke', category: 'Actions', icon: '⌨',
    description: 'Send a keystroke',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { keys: '', holdMs: 100 },
  },

  // ── Integrations ──
  {
    type: 'obs-command', label: 'OBS Command', category: 'Integrations', icon: '🎬',
    description: 'Send an OBS WebSocket command',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { command: 'switchScene', params: {} },
  },
  {
    type: 'webhook', label: 'Webhook', category: 'Integrations', icon: '🌐',
    description: 'Send HTTP webhook',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { url: '', method: 'POST', headers: {}, body: '' },
  },
  {
    type: 'http-request', label: 'HTTP Request', category: 'Integrations', icon: '📡',
    description: 'Make HTTP request',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }, { id: 'error', label: 'Error', type: 'any' }],
    defaultConfig: { url: '', method: 'GET', headers: {}, body: '', resultVariable: '_httpResult' },
  },
  {
    type: 'run-workflow', label: 'Run Workflow', category: 'Integrations', icon: '▶',
    description: 'Execute another workflow',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [{ id: 'out', label: '', type: 'any' }],
    defaultConfig: { workflowId: '' },
  },
  {
    type: 'stop-workflow', label: 'Stop Workflow', category: 'Integrations', icon: '⏹',
    description: 'Stop current workflow',
    inputs: [{ id: 'in', label: '', type: 'any' }],
    outputs: [],
    defaultConfig: { reason: 'Stopped by workflow' },
  },
];

const nodeMap = new Map<string, NodeDefinition>(NODES.map(n => [n.type, n]));
const categoryMap = new Map<string, NodeDefinition[]>();
for (const n of NODES) {
  const arr = categoryMap.get(n.category) || [];
  arr.push(n);
  categoryMap.set(n.category, arr);
}

export function getAllNodeDefinitions(): readonly NodeDefinition[] { return NODES; }
export function getNodeDefinition(type: string): NodeDefinition | undefined { return nodeMap.get(type); }
export function getNodesByCategory(): Map<string, readonly NodeDefinition[]> { return categoryMap as any; }
