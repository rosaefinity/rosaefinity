import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { cn } from '../../lib/utils';
import { ControlRow } from './ControlRow';

interface NumberControlProps {
  label: string;
  description?: string;
  tooltip?: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  defaultValue?: number;
  onReset?: () => void;
  className?: string;
}

function NumberControlInner({
  label,
  description,
  tooltip,
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  disabled = false,
  compact = false,
  fullWidth = false,
  defaultValue,
  onReset,
  className,
}: NumberControlProps): React.ReactElement {
  const [text, setText] = useState(String(value));
  const lastCommittedRef = useRef(value);

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clamp = useCallback((v: number) => {
    let clamped = v;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    return clamped;
  }, [min, max]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  }, [onChange, clamp]);

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(text);
    if (isNaN(parsed)) {
      setText(String(value));
      return;
    }
    const clamped = clamp(parsed);
    setText(String(clamped));
    if (clamped !== lastCommittedRef.current) {
      lastCommittedRef.current = clamped;
      onCommit?.(clamped);
    }
  }, [text, value, clamp, onCommit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const delta = e.key === 'ArrowUp' ? step : -step;
      const next = clamp(parseFloat(text) + delta);
      setText(String(next));
      onChange(next);
      onCommit?.(next);
    }
  }, [text, step, clamp, onChange, onCommit]);

  const isDirty = defaultValue !== undefined && value !== defaultValue;

  return (
    <ControlRow
      label={label}
      description={description}
      tooltip={tooltip}
      disabled={disabled}
      compact={compact}
      fullWidth={fullWidth}
      isDirty={isDirty}
      onReset={onReset}
      className={className}
    >
      <input
        type="number"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'w-full h-8 px-2 rounded-md text-sm text-white font-mono',
          'bg-white/[0.06] border border-white/10',
          'placeholder:text-white/30',
          'focus:outline-none focus:ring-1 focus:ring-primary/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          '[appearance:textfield]',
          '[&::-webkit-outer-spin-button]:appearance-none',
          '[&::-webkit-inner-spin-button]:appearance-none',
        )}
      />
    </ControlRow>
  );
}

export const NumberControl = memo(NumberControlInner);
NumberControl.displayName = 'NumberControl';
