import React, { useCallback, useRef, useState } from "react";

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  scrubSensitivity?: number;
}

export function NumberField({
  label,
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  disabled,
  scrubSensitivity = 1,
}: NumberFieldProps): JSX.Element {
  const [localValue, setLocalValue] = useState(String(value));
  const isScrubbing = useRef(false);
  const startX = useRef(0);
  const startValue = useRef(0);

  const prevValue = useRef(value);
  if (prevValue.current !== value) {
    prevValue.current = value;
    setLocalValue(String(value));
  }

  const clamp = useCallback(
    (v: number): number => {
      if (min !== undefined && v < min) return min;
      if (max !== undefined && v > max) return max;
      return v;
    },
    [min, max],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLocalValue(raw);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onChange(clamp(parsed));
      }
    },
    [onChange, clamp],
  );

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(localValue);
    if (isNaN(parsed)) {
      setLocalValue(String(value));
      return;
    }
    const clamped = clamp(parsed);
    setLocalValue(String(clamped));
    if (clamped !== value) {
      onCommit?.(clamped);
    }
  }, [localValue, value, clamp, onCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = clamp(value + step);
        setLocalValue(String(next));
        onChange(next);
        onCommit?.(next);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = clamp(value - step);
        setLocalValue(String(next));
        onChange(next);
        onCommit?.(next);
      }
    },
    [value, step, clamp, onChange, onCommit],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      isScrubbing.current = true;
      startX.current = e.clientX;
      startValue.current = value;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isScrubbing.current) return;
        const delta = moveEvent.clientX - startX.current;
        const newValue = clamp(startValue.current + delta * step * scrubSensitivity);
        setLocalValue(String(newValue));
        onChange(newValue);
      };

      const handleMouseUp = () => {
        isScrubbing.current = false;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        const parsed = parseFloat(localValue);
        if (!isNaN(parsed)) {
          onCommit?.(clamp(parsed));
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [disabled, value, step, scrubSensitivity, clamp, onChange, onCommit, localValue],
  );

  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-xs text-white/50 font-medium cursor-ew-resize select-none"
        onMouseDown={handleMouseDown}
      >
        {label}
      </label>
      <input
        type="number"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="h-8 px-2 rounded-md bg-white/[0.06] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}
