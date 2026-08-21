// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Settings Hook
// v3.1 Architecture Spec (Frozen)
//
// Manages settings state with undo/redo, validation,
// debounced persistence, and change subscription.
// ─────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SettingsField, ValidationRule } from '../types';

// ─── History Entry ───

interface HistoryEntry {
  values: Record<string, unknown>;
  timestamp: number;
}

// ─── Validation Result ───

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

// ─── Hook Options ───

interface UseSettingsOptions {
  schema: SettingsField[];
  initialValues: Record<string, unknown>;
  defaultValues: Record<string, unknown>;
  onChange?: (values: Record<string, unknown>) => void;
  onValidate?: (values: Record<string, unknown>) => ValidationResult;
  debounceMs?: number;
  maxHistory?: number;
}

// ─── Hook Return ───

export interface UseSettingsReturn {
  values: Record<string, unknown>;
  errors: FieldError[];
  isValid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  renderCount: number;

  setValue: (key: string, value: unknown) => void;
  setValues: (patch: Record<string, unknown>) => void;
  getValue: (key: string) => unknown;
  resetField: (key: string) => void;
  resetGroup: (section: string) => void;
  resetAll: () => void;
  undo: () => void;
  redo: () => void;
  validate: () => ValidationResult;
  exportJSON: () => string;
  importJSON: (json: string) => boolean;
  subscribe: (callback: (values: Record<string, unknown>) => void) => () => void;
}

// ─── Nested Value Helpers ───

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    return (current as Record<string, unknown>)?.[key];
  }, obj);
}

function setNestedValue(obj: Record<string, unknown>, path: string, newValue: unknown): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  const keys = path.split('.');
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = newValue;
  return result;
}

// ─── Validation ───

function validateField(
  field: SettingsField,
  value: unknown,
  allValues: Record<string, unknown>,
): string | null {
  const rules = field.validation ?? [];

  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return rule.message;
        }
        break;
      case 'min':
        if (typeof value === 'number' && typeof rule.value === 'number' && value < rule.value) {
          return rule.message;
        }
        break;
      case 'max':
        if (typeof value === 'number' && typeof rule.value === 'number' && value > rule.value) {
          return rule.message;
        }
        break;
      case 'pattern':
        if (typeof value === 'string' && typeof rule.value === 'string') {
          if (!new RegExp(rule.value).test(value)) {
            return rule.message;
          }
        }
        break;
      case 'custom':
        if (rule.validator && !rule.validator(value)) {
          return rule.message;
        }
        break;
    }
  }

  return null;
}

// ─── Visibility Evaluation ───

function evaluateVisibility(
  field: SettingsField,
  values: Record<string, unknown>,
): boolean {
  if (!field.dependsOn) return true;

  const { key, value, operator = 'equals' } = field.dependsOn;
  const currentValue = getNestedValue(values, key);

  switch (operator) {
    case 'equals': return currentValue === value;
    case 'not-equals': return currentValue !== value;
    case 'greater-than': return Number(currentValue) > Number(value);
    case 'less-than': return Number(currentValue) < Number(value);
    case 'contains': return String(currentValue).includes(String(value));
    default: return true;
  }
}

// ─── Hook ───

export function useSettings({
  schema,
  initialValues,
  defaultValues,
  onChange,
  onValidate,
  debounceMs = 300,
  maxHistory = 50,
}: UseSettingsOptions): UseSettingsReturn {
  const [values, setValuesState] = useState<Record<string, unknown>>(initialValues);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([{ values: initialValues, timestamp: Date.now() }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [renderCount, setRenderCount] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribersRef = useRef<Set<(values: Record<string, unknown>) => void>>(new Set());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Increment render count
  useEffect(() => {
    setRenderCount(prev => prev + 1);
  });

  // Notify subscribers
  const notifySubscribers = useCallback((newValues: Record<string, unknown>) => {
    for (const cb of subscribersRef.current) {
      try { cb(newValues); } catch { /* ignore */ }
    }
  }, []);

  // Debounced onChange
  const debouncedChange = useCallback((newValues: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChangeRef.current?.(newValues);
      notifySubscribers(newValues);
    }, debounceMs);
  }, [debounceMs, notifySubscribers]);

  // Validate all fields
  const validate = useCallback((): ValidationResult => {
    const allErrors: FieldError[] = [];

    for (const field of schema) {
      if (!evaluateVisibility(field, values)) continue;
      const error = validateField(field, getNestedValue(values, field.key), values);
      if (error) {
        allErrors.push({ field: field.key, message: error });
      }
    }

    // External validation
    if (onValidate) {
      const external = onValidate(values);
      allErrors.push(...external.errors);
    }

    const valid = allErrors.length === 0;
    setErrors(allErrors);
    return { valid, errors: allErrors };
  }, [schema, values, onValidate]);

  // Push to history
  const pushHistory = useCallback((newValues: Record<string, unknown>) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, { values: JSON.parse(JSON.stringify(newValues)), timestamp: Date.now() }];
      if (next.length > maxHistory) next.shift();
      return next;
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));
  }, [historyIndex, maxHistory]);

  // setValue
  const setValue = useCallback((key: string, value: unknown) => {
    setValuesState(prev => {
      const next = setNestedValue(prev, key, value);
      pushHistory(next);
      debouncedChange(next);
      return next;
    });
  }, [pushHistory, debouncedChange]);

  // setValues (batch)
  const setValues = useCallback((patch: Record<string, unknown>) => {
    setValuesState(prev => {
      let next = { ...prev };
      for (const [key, value] of Object.entries(patch)) {
        next = setNestedValue(next, key, value);
      }
      pushHistory(next);
      debouncedChange(next);
      return next;
    });
  }, [pushHistory, debouncedChange]);

  // getValue
  const getValue = useCallback((key: string): unknown => {
    return getNestedValue(values, key);
  }, [values]);

  // resetField
  const resetField = useCallback((key: string) => {
    const defaultValue = getNestedValue(defaultValues, key);
    setValue(key, defaultValue);
  }, [defaultValues, setValue]);

  // resetGroup
  const resetGroup = useCallback((section: string) => {
    const fields = schema.filter(f => f.section === section);
    const patch: Record<string, unknown> = {};
    for (const field of fields) {
      const path = field.key;
      patch[path] = getNestedValue(defaultValues, path);
    }
    setValues(patch);
  }, [schema, defaultValues, setValues]);

  // resetAll
  const resetAll = useCallback(() => {
    setValuesState(JSON.parse(JSON.stringify(defaultValues)));
    pushHistory(defaultValues);
    debouncedChange(defaultValues);
  }, [defaultValues, pushHistory, debouncedChange]);

  // undo
  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setHistoryIndex(historyIndex - 1);
    setValuesState(prev.values);
    debouncedChange(prev.values);
  }, [history, historyIndex, debouncedChange]);

  // redo
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setHistoryIndex(historyIndex + 1);
    setValuesState(next.values);
    debouncedChange(next.values);
  }, [history, historyIndex, debouncedChange]);

  // exportJSON
  const exportJSON = useCallback((): string => {
    return JSON.stringify(values, null, 2);
  }, [values]);

  // importJSON
  const importJSON = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      setValuesState(parsed);
      pushHistory(parsed);
      debouncedChange(parsed);
      return true;
    } catch {
      return false;
    }
  }, [pushHistory, debouncedChange]);

  // subscribe
  const subscribe = useCallback((callback: (values: Record<string, unknown>) => void): (() => void) => {
    subscribersRef.current.add(callback);
    return () => { subscribersRef.current.delete(callback); };
  }, []);

  return {
    values,
    errors,
    isValid: errors.length === 0,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    renderCount,
    setValue,
    setValues,
    getValue,
    resetField,
    resetGroup,
    resetAll,
    undo,
    redo,
    validate,
    exportJSON,
    importJSON,
    subscribe,
  };
}

// ─── Utility Exports ───

export { getNestedValue, setNestedValue, evaluateVisibility, validateField };
