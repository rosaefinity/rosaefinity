import React, { useCallback, useRef, useState } from "react";

interface RangeFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  formatValue?: (value: number) => string;
}

export function RangeField({
  label,
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 0.01,
  disabled,
  formatValue,
}: RangeFieldProps): React.JSX.Element {
  const [localValue, setLocalValue] = useState(value);
  const prevValue = useRef(value);
  if (prevValue.current !== value) {
    prevValue.current = value;
    setLocalValue(value);
  }

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseFloat(e.target.value);
      setLocalValue(parsed);
      onChange(parsed);
    },
    [onChange],
  );

  const handleMouseUp = useCallback(() => {
    onCommit?.(localValue);
  }, [localValue, onCommit]);

  const displayValue = formatValue ? formatValue(localValue) : localValue.toFixed(2);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white/50 font-medium">{label}</label>
        <span className="text-xs text-white/40 font-mono">{displayValue}</span>
      </div>
      <input
        type="range"
        value={localValue}
        onChange={handleChange}
        onMouseUp={handleMouseUp}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed accent-primary"
      />
    </div>
  );
}
