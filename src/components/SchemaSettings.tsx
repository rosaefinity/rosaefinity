// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Universal Settings Renderer
// v3.1 Architecture Spec (Frozen)
//
// Schema-driven settings form that auto-generates UI from
// SettingsSchema. Supports all 29+ field types.
// ─────────────────────────────────────────────────────

import React, { memo, useMemo, useCallback, Fragment, useState, useEffect } from 'react';
import type { SettingsSchema, SettingsField } from '../overlays/types';
import { evaluateVisibility } from '../overlays/base/useSettings';

// ─── Props ───

interface SchemaSettingsProps {
  schema: SettingsSchema;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  errors?: Array<{ field: string; message: string }>;
  disabled?: boolean;
}

// ─── Nested Value Helpers ───

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!path || typeof path !== 'string') {
    console.error('[SCHEMA-DEBUG] getNestedValue called with invalid path:', path, 'type:', typeof path, 'obj keys:', obj ? Object.keys(obj).slice(0, 10) : 'null');
    return undefined;
  }
  return path.split('.').reduce((current, key) => {
    return (current as Record<string, unknown>)?.[key];
  }, obj);
}

// ─── Group fields by section ───

function groupBySection(schema: SettingsSchema): Array<{ section: string; fields: SettingsField[] }> {
  console.log('[SCHEMA-DEBUG] groupBySection called, schema length:', schema?.length, 'first item:', schema?.[0] ? { keys: Object.keys(schema[0]), hasFields: 'fields' in schema[0], section: (schema[0] as any).section, title: (schema[0] as any).title, key: (schema[0] as any).key } : 'empty');
  const groups = new Map<string, SettingsField[]>();
  for (const field of schema) {
    const section = (field as any).section || (field as any).title || 'General';
    const existing = groups.get(section);
    if (existing) {
      existing.push(field);
    } else {
      groups.set(section, [field]);
    }
  }
  return Array.from(groups.entries()).map(([section, fields]) => ({ section, fields }));
}

// ─── SchemaColorField ───
// Dedicated color field component with local state to fix native <input type="color"> value commitment issue.
// The native color picker's onChange fires correctly, but external store updates triggered by onChange
// cause React re-renders that interrupt the native picker's value commitment when the input is
// controlled directly by external state. Using local state as an intermediary preserves the
// picker interaction while still propagating changes to the parent onChange.

interface SchemaColorFieldProps {
  value: unknown;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  label: string;
  description?: string;
  renderLabel: () => React.ReactElement;
  renderError: () => React.ReactElement | null;
  renderDescription: () => React.ReactElement | null;
  inputClass: string;
  disabledClass: string;
}

function SchemaColorField({
  value,
  onChange,
  disabled,
  error,
  label,
  description,
  renderLabel,
  renderError,
  renderDescription,
  inputClass,
  disabledClass,
}: SchemaColorFieldProps): React.ReactElement {
  const fallbackColor = '#7C3AED';
  const initialValue = String(value ?? fallbackColor);

  const [localHex, setLocalHex] = useState<string>(initialValue);

  // Sync local state when external value changes (profile switch, config load, etc.)
  useEffect(() => {
    setLocalHex(String(value ?? fallbackColor));
  }, [value]);

  const handleChange = useCallback((newHex: string) => {
    setLocalHex(newHex);
    onChange(newHex);
  }, [onChange]);

  return (
    <div className={disabledClass}>
      {renderLabel()}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={localHex}
          onChange={e => handleChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-white/[0.08] cursor-pointer bg-transparent"
          disabled={disabled}
        />
        <input
          type="text"
          value={localHex}
          onChange={e => handleChange(e.target.value)}
          className={`${inputClass} flex-1 font-mono text-xs`}
          disabled={disabled}
        />
      </div>
      {renderError()}{renderDescription()}
    </div>
  );
}

// ─── Field Renderer ───

const FieldRenderer = memo(function FieldRenderer({
  field,
  value,
  onChange,
  allValues,
  error,
  disabled,
}: {
  field: SettingsField;
  value: unknown;
  onChange: (value: unknown) => void;
  allValues: Record<string, unknown>;
  error?: string;
  disabled?: boolean;
}): React.ReactElement | null {
  // Check conditional visibility
  if (!evaluateVisibility(field, allValues)) return null;

  const baseInput = 'w-full h-9 px-3 rounded-lg bg-white/[0.04] border text-sm text-white/80 outline-none transition-colors';
  const normalBorder = 'border-white/[0.08] focus:border-primary/40';
  const errorBorder = 'border-red-500/50 focus:border-red-500/70';
  const inputClass = `${baseInput} ${error ? errorBorder : normalBorder}`;
  const disabledClass = disabled ? 'opacity-50 pointer-events-none' : '';

  const renderLabel = () => (
    <label className="block text-xs text-white/50 mb-1.5">
      {field.label}
      {field.validation?.some(v => v.type === 'required') && (
        <span className="text-red-400 ml-0.5">*</span>
      )}
    </label>
  );

  const renderError = () => error ? (
    <p className="text-[10px] text-red-400 mt-1">{error}</p>
  ) : null;

  const renderDescription = () => field.description ? (
    <p className="text-[10px] text-white/25 mt-1">{field.description}</p>
  ) : null;

  switch (field.type) {
    case 'text':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <input type="text" value={String(value ?? '')} onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder} className={inputClass} disabled={disabled} />
          {renderError()}{renderDescription()}
        </div>
      );

    case 'textarea':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <textarea value={String(value ?? '')} onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder} rows={4}
            className={`${inputClass} h-auto py-2 resize-y`} disabled={disabled} />
          {renderError()}{renderDescription()}
        </div>
      );

    case 'number':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <input type="number" value={Number(value ?? 0)} min={field.min} max={field.max}
            step={field.step} onChange={e => onChange(parseFloat(e.target.value) || 0)}
            className={inputClass} disabled={disabled} />
          {renderError()}{renderDescription()}
        </div>
      );

    case 'slider':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <div className="flex items-center gap-3">
            <input type="range" min={field.min ?? 0} max={field.max ?? 100}
              step={field.step ?? 1} value={Number(value ?? 0)}
              onChange={e => onChange(parseFloat(e.target.value))}
              className="flex-1 h-1.5 accent-primary rounded-full" disabled={disabled} />
            <span className="text-xs text-white/50 w-12 text-right font-mono">
              {typeof value === 'number' ? value : '—'}
            </span>
          </div>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'boolean':
    case 'toggle':
    case 'switch':
      return (
        <div className={disabledClass}>
          <div className="flex items-center justify-between">
            {renderLabel()}
            <button type="button" onClick={() => onChange(!Boolean(value))}
              className={`relative w-10 h-5 rounded-full transition-colors ${Boolean(value) ? 'bg-primary' : 'bg-white/10'}`}
              disabled={disabled}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${Boolean(value) ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'checkbox':
      return (
        <div className={disabledClass}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={Boolean(value)} onChange={e => onChange(e.target.checked)}
              className="accent-primary w-4 h-4" disabled={disabled} />
            <span className="text-xs text-white/60">{field.label}</span>
          </label>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'radio':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <div className="space-y-1.5">
            {field.options?.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={field.key} value={opt.value}
                  checked={value === opt.value} onChange={() => onChange(opt.value)}
                  className="accent-primary" disabled={disabled} />
                <span className="text-xs text-white/60">{opt.label}</span>
              </label>
            ))}
          </div>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'select':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <select value={String(value ?? '')} onChange={e => onChange(e.target.value)}
            className={`${inputClass} text-white/80`}
            style={{ colorScheme: 'dark' }}
            disabled={disabled}>
            <option value="" className="bg-[#1a1a2e] text-white/80">Select...</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-[#1a1a2e] text-white/80">{opt.label}</option>
            ))}
          </select>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'multiselect':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <div className="space-y-1">
            {field.options?.map(opt => {
              const selected = Array.isArray(value) && value.includes(opt.value);
              return (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selected}
                    onChange={e => {
                      const arr = Array.isArray(value) ? [...value] : [];
                      if (e.target.checked) {
                        arr.push(opt.value);
                      } else {
                        const idx = arr.indexOf(opt.value);
                        if (idx !== -1) arr.splice(idx, 1);
                      }
                      onChange(arr);
                    }}
                    className="accent-primary" disabled={disabled} />
                  <span className="text-xs text-white/60">{opt.label}</span>
                </label>
              );
            })}
          </div>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'color':
      return (
        <SchemaColorField
          value={value}
          onChange={onChange}
          disabled={disabled}
          error={error}
          label={field.label}
          description={field.description}
          renderLabel={renderLabel}
          renderError={renderError}
          renderDescription={renderDescription}
          inputClass={inputClass}
          disabledClass={disabledClass}
        />
      );

    case 'font':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <select value={String(value ?? '')} onChange={e => onChange(e.target.value)}
            className={inputClass} disabled={disabled}>
            <option value="system-ui">System UI</option>
            <option value="'Segoe UI', sans-serif">Segoe UI</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="'Helvetica Neue', sans-serif">Helvetica Neue</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="monospace">Monospace</option>
          </select>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'image':
    case 'video':
    case 'audio':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <div className="flex items-center gap-2">
            <input type="text" value={String(value ?? '')} onChange={e => onChange(e.target.value)}
              placeholder={`Enter ${field.type} URL...`}
              className={`${inputClass} flex-1`} disabled={disabled} />
            <label className="px-3 h-9 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white/50 cursor-pointer hover:bg-white/[0.10] transition-colors">
              Browse
              <input type="file" accept={field.type === 'image' ? 'image/*' : field.type === 'video' ? 'video/*' : 'audio/*'}
                className="hidden" onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) onChange(URL.createObjectURL(file));
                }} />
            </label>
          </div>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'button':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <button type="button" onClick={field.onButtonPress}
            className="px-4 py-2 rounded-lg bg-primary/20 text-primary text-xs font-medium border border-primary/20 hover:bg-primary/30 transition-colors"
            disabled={disabled}>
            {field.label}
          </button>
          {renderDescription()}
        </div>
      );

    case 'duration':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <div className="flex items-center gap-2">
            <input type="number" value={Number(value ?? 5)} min={field.min ?? 0} max={field.max ?? 300}
              step={field.step ?? 1} onChange={e => onChange(parseFloat(e.target.value) || 0)}
              className={`${inputClass} flex-1`} disabled={disabled} />
            <span className="text-xs text-white/40 shrink-0">seconds</span>
          </div>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'animation':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <select value={String(value ?? 'fade')} onChange={e => onChange(e.target.value)}
            className={inputClass} disabled={disabled}>
            <option value="none">None</option>
            <option value="fade">Fade</option>
            <option value="slide-left">Slide Left</option>
            <option value="slide-right">Slide Right</option>
            <option value="slide-up">Slide Up</option>
            <option value="slide-down">Slide Down</option>
            <option value="scale">Scale</option>
            <option value="bounce">Bounce</option>
          </select>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'shadow':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 cursor-pointer col-span-2">
              <input type="checkbox" checked={Boolean((value as Record<string, unknown>)?.enabled)}
                onChange={e => onChange({ ...(value as Record<string, unknown> ?? {}), enabled: e.target.checked })}
                className="accent-primary" disabled={disabled} />
              <span className="text-xs text-white/60">Enabled</span>
            </label>
            <input type="color" value={String((value as Record<string, unknown>)?.color ?? '#000000')}
              onChange={e => onChange({ ...(value as Record<string, unknown> ?? {}), color: e.target.value })}
              className="w-full h-8 rounded border border-white/[0.08]" disabled={disabled} />
            <input type="number" value={Number((value as Record<string, unknown>)?.blur ?? 8)}
              onChange={e => onChange({ ...(value as Record<string, unknown> ?? {}), blur: Number(e.target.value) })}
              placeholder="Blur" className={`${inputClass} h-8 text-xs`} disabled={disabled} />
            <input type="number" value={Number((value as Record<string, unknown>)?.offsetX ?? 0)}
              onChange={e => onChange({ ...(value as Record<string, unknown> ?? {}), offsetX: Number(e.target.value) })}
              placeholder="X" className={`${inputClass} h-8 text-xs`} disabled={disabled} />
            <input type="number" value={Number((value as Record<string, unknown>)?.offsetY ?? 4)}
              onChange={e => onChange({ ...(value as Record<string, unknown> ?? {}), offsetY: Number(e.target.value) })}
              placeholder="Y" className={`${inputClass} h-8 text-xs`} disabled={disabled} />
          </div>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'padding':
    case 'margin':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <div className="grid grid-cols-4 gap-1.5">
            {(['top', 'right', 'bottom', 'left'] as const).map(side => (
              <input key={side} type="number"
                value={Number((value as Record<string, unknown>)?.[side] ?? 0)}
                onChange={e => onChange({ ...(value as Record<string, unknown> ?? {}), [side]: Number(e.target.value) })}
                placeholder={side.charAt(0).toUpperCase()} min={0}
                className={`${inputClass} h-8 text-xs text-center`} disabled={disabled} />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-white/20 mt-1 px-1">
            <span>top</span><span>right</span><span>bottom</span><span>left</span>
          </div>
          {renderError()}{renderDescription()}
        </div>
      );

    case 'json':
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <textarea value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={e => { try { onChange(JSON.parse(e.target.value)); } catch { /* ignore */ } }}
            rows={6} className={`${inputClass} h-auto py-2 font-mono text-xs resize-y`} disabled={disabled} />
          {renderError()}{renderDescription()}
        </div>
      );

    case 'group':
      return (
        <div className={`${disabledClass} border border-white/[0.06] rounded-lg p-3 space-y-3`}>
          {renderLabel()}
          {field.children?.map(child => (
            <FieldRenderer key={child.key} field={child}
              value={getNestedValue(allValues, child.key)}
              onChange={v => {
                // This would need to bubble up — simplified for now
                onChange(v);
              }}
              allValues={allValues} disabled={disabled} />
          ))}
          {renderError()}
        </div>
      );

    default:
      return (
        <div className={disabledClass}>
          {renderLabel()}
          <input type="text" value={String(value ?? '')} onChange={e => onChange(e.target.value)}
            className={inputClass} disabled={disabled} />
          {renderError()}{renderDescription()}
        </div>
      );
  }
});

// ─── Section Renderer ───

const SectionRenderer = memo(function SectionRenderer({
  section,
  fields,
  values,
  onFieldChange,
  errors,
  disabled,
}: {
  section: string;
  fields: SettingsField[];
  values: Record<string, unknown>;
  onFieldChange: (key: string, value: unknown) => void;
  errors: Array<{ field: string; message: string }>;
  disabled?: boolean;
}): React.ReactElement {
  const errorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const err of errors) map.set(err.field, err.message);
    return map;
  }, [errors]);

  // Filter visible fields
  const visibleFields = useMemo(
    () => fields.filter(f => evaluateVisibility(f, values)),
    [fields, values],
  );

  if (visibleFields.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3 px-1">
        {section}
      </h3>
      <div className="space-y-4">
        {visibleFields.map(field => {
          if (!field.key || typeof field.key !== 'string') {
            console.error('[SCHEMA-DEBUG] Skipping field with invalid key:', { key: field.key, label: field.label, type: field.type, section: (field as any).section });
            return null;
          }
          return (
            <FieldRenderer
              key={field.key}
              field={field}
              value={getNestedValue(values, field.key)}
              onChange={(v) => onFieldChange(field.key, v)}
              allValues={values}
              error={errorMap.get(field.key)}
              disabled={disabled}
            />
          );
        })}
      </div>
    </div>
  );
});

// ─── Main Component ───

function SchemaSettingsInner({
  schema,
  values,
  onChange,
  errors = [],
  disabled = false,
}: SchemaSettingsProps): React.ReactElement {
  const sections = useMemo(() => groupBySection(schema), [schema]);

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    onChange(key, value);
  }, [onChange]);

  return (
    <div className="space-y-1">
      {sections.map(({ section, fields }) => (
        <SectionRenderer
          key={section}
          section={section}
          fields={fields}
          values={values}
          onFieldChange={handleFieldChange}
          errors={errors}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export const SchemaSettings = memo(SchemaSettingsInner);
