// =============================================
// RosaeFinity â€” Variable Manager
// Global, workflow, and temp variable scopes.
// String interpolation support.
// =============================================

import type { WorkflowVariable } from '../types';
import { BUILTIN_VARIABLES } from '../types';

export class VariableManager {
  private globalVars = new Map<string, unknown>();
  private workflowVars = new Map<string, unknown>();
  private tempVars = new Map<string, unknown>();

  /** Set a variable */
  set(name: string, value: unknown, scope: 'global' | 'workflow' | 'temp' = 'workflow'): void {
    switch (scope) {
      case 'global': this.globalVars.set(name, value); break;
      case 'workflow': this.workflowVars.set(name, value); break;
      case 'temp': this.tempVars.set(name, value); break;
    }
  }

  /** Get a variable (scope priority: temp > workflow > global > builtin) */
  get(name: string): unknown {
    if (this.tempVars.has(name)) return this.tempVars.get(name);
    if (this.workflowVars.has(name)) return this.workflowVars.get(name);
    if (this.globalVars.has(name)) return this.globalVars.get(name);
    if (name in BUILTIN_VARIABLES) return BUILTIN_VARIABLES[name];
    return undefined;
  }

  /** Get all variables merged (for condition evaluation) */
  getAll(): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...BUILTIN_VARIABLES };
    for (const [k, v] of this.globalVars) merged[k] = v;
    for (const [k, v] of this.workflowVars) merged[k] = v;
    for (const [k, v] of this.tempVars) merged[k] = v;
    return merged;
  }

  /** Interpolate a string: "Hello {username}" â†’ "Hello John" */
  interpolate(template: string): string {
    return template.replace(/\{(\w+)\}/g, (_, name) => {
      const val = this.get(name);
      return val !== undefined ? String(val) : `{${name}}`;
    });
  }

  /** Initialize workflow variables from definitions */
  initWorkflow(variables: WorkflowVariable[]): void {
    this.workflowVars.clear();
    for (const v of variables) {
      this.workflowVars.set(v.name, v.defaultValue);
    }
  }

  /** Clear temp variables */
  clearTemp(): void {
    this.tempVars.clear();
  }

  /** Get workflow variables as array */
  getWorkflowVariables(): Record<string, unknown> {
    return Object.fromEntries(this.workflowVars);
  }
}
