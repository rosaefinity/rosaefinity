import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { cn } from '../../lib/utils';
import { ControlRow } from './ControlRow';

interface SliderControlProps {
  label: string;
  description?: string;
  tooltip?: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  formatValue?: (value: number) => string;
  defaultValue?: number;
  onReset?: () => void;
  className?: string;
}

const DEFAULT_FORMAT = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1);

function SliderControlInner({
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
  formatValue = DEFAULT_FORMAT,
  defaultValue,
  onReset,
  className,
}: SliderControlProps): React.ReactElement {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value);
    if (!isNaN(next)) {
      setLocalValue(next);
      onChange(next);
    }
  }, [onChange]);

  const handleMouseUp = useCallback(() => {
    onCommit?.(localValue);
  }, [onCommit, localValue]);

  const isDirty = defaultValue !== undefined && localValue !== defaultValue;

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
      <div className="flex items-center gap-2 w-full">
        <input
          ref={inputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={handleChange}
          onMouseUp={handleMouseUp}
          onTouchEnd={handleMouseUp}
          disabled={disabled}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={localValue}
          className={cn(
            'flex-1 h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'accent-primary',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(124,58,237,0.4)]',
          )}
        />
        <span className="text-xs text-white/40 font-mono w-10 text-right shrink-0">
          {formatValue(localValue)}
        </span>
      </div>
    </ControlRow>
  );
}

export const SliderControl = memo(SliderControlInner);
SliderControl.displayName = 'SliderControl';
