// =============================================
// RosaeFinity â€” Condition Engine
// Evaluates conditions with AND/OR/NOT,
// nested conditions, and all operators.
// =============================================

import type { ConditionOperator } from '../types';

export interface Condition {
  operator: ConditionOperator;
  left?: unknown;
  right?: unknown;
  children?: Condition[];
}

export function evaluateCondition(condition: Condition, variables: Record<string, unknown>): boolean {
  const { operator } = condition;

  // Logical operators
  if (operator === 'and') {
    return (condition.children || []).every(c => evaluateCondition(c, variables));
  }
  if (operator === 'or') {
    return (condition.children || []).some(c => evaluateCondition(c, variables));
  }
  if (operator === 'not') {
    return !evaluateCondition(condition.children?.[0] || { operator: 'equals', left: true, right: false }, variables);
  }

  // Resolve left/right values (support variable interpolation)
  const left = resolveValue(condition.left, variables);
  const right = resolveValue(condition.right, variables);

  switch (operator) {
    case 'equals': return left === right;
    case 'not-equals': return left !== right;
    case 'greater-than': return Number(left) > Number(right);
    case 'less-than': return Number(left) < Number(right);
    case 'greater-equal': return Number(left) >= Number(right);
    case 'less-equal': return Number(left) <= Number(right);
    case 'contains': return String(left).includes(String(right));
    case 'starts-with': return String(left).startsWith(String(right));
    case 'ends-with': return String(left).endsWith(String(right));
    case 'regex': {
      try {
        return new RegExp(String(right)).test(String(left));
      } catch {
        return false;
      }
    }
    default: return false;
  }
}

function resolveValue(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    const varName = value.slice(1, -1);
    return variables[varName] ?? value;
  }
  if (typeof value === 'string') {
    // Interpolate: "Hello {username}" â†’ "Hello John"
    return value.replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? `{${name}}`));
  }
  return value;
}
