// =============================================
// RosaeFinity — Workflow Validator
// Detects orphan nodes, broken links, circular
// loops, invalid variables, missing triggers.
// =============================================

import type { Workflow, WorkflowNode, WorkflowConnection } from '../types';

export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  nodeId?: string;
  connectionId?: string;
}

export function validateWorkflow(workflow: Workflow): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Check for start node
  const startNodes = workflow.nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push({ type: 'error', message: 'Workflow must have a Start node' });
  }
  if (startNodes.length > 1) {
    errors.push({ type: 'error', message: 'Workflow can only have one Start node' });
  }

  // 2. Check for orphan nodes (no connections in or out)
  for (const node of workflow.nodes) {
    if (node.type === 'start' || node.type === 'end') continue;
    const hasIncoming = workflow.connections.some(c => c.targetNodeId === node.id);
    const hasOutgoing = workflow.connections.some(c => c.sourceNodeId === node.id);
    if (!hasIncoming && !hasOutgoing) {
      errors.push({ type: 'warning', message: `Orphan node: "${node.label}"`, nodeId: node.id });
    }
  }

  // 3. Check for broken connections
  const nodeIds = new Set(workflow.nodes.map(n => n.id));
  for (const conn of workflow.connections) {
    if (!nodeIds.has(conn.sourceNodeId)) {
      errors.push({ type: 'error', message: `Connection references missing source node`, connectionId: conn.id });
    }
    if (!nodeIds.has(conn.targetNodeId)) {
      errors.push({ type: 'error', message: `Connection references missing target node`, connectionId: conn.id });
    }
  }

  // 4. Detect circular loops (DFS)
  const visited = new Set<string>();
  const inStack = new Set<string>();
  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true; // Cycle found
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const conn of workflow.connections.filter(c => c.sourceNodeId === nodeId)) {
      if (dfs(conn.targetNodeId)) return true;
    }
    inStack.delete(nodeId);
    return false;
  }

  if (startNodes.length > 0) {
    const hasCycle = dfs(startNodes[0].id);
    if (hasCycle) {
      errors.push({ type: 'warning', message: 'Workflow contains a circular loop' });
    }
  }

  // 5. Check variable references
  const definedVars = new Set(workflow.variables.map(v => v.name));
  for (const node of workflow.nodes) {
    if (node.type === 'variable') {
      const varName = node.config.variable as string;
      if (varName && !definedVars.has(varName) && !varName.startsWith('_')) {
        errors.push({ type: 'warning', message: `Variable "${varName}" not defined in workflow`, nodeId: node.id });
      }
    }
  }

  return errors;
}
