import React, { useCallback, useRef } from "react";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  disabled?: boolean;
}

export function ColorField({ label, value, onChange, onCommit, disabled }: ColorFieldProps): JSX.Element {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value;
      if (/^#[0-9a-fA-F]{0,6}$/.test(hex) || hex === "") {
        onChange(hex);
      }
    },
    [onChange],
  );

  const handleHexBlur = useCallback(() => {
    if (value && value.length === 4 && value.startsWith("#")) {
      const padded = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
      onChange(padded);
      onCommit?.(padded);
    } else {
      onCommit?.(value);
    }
  }, [value, onChange, onCommit]);

  const handlePickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      onCommit?.(e.target.value);
    },
    [onChange, onCommit],
  );

  const openPicker = useCallback(() => {
    colorInputRef.current?.click();
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-white/50 font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="w-8 h-8 rounded-md border border-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          style={{ backgroundColor: value || "#000000" }}
          aria-label={`Pick ${label}`}
        />
        <input
          ref={colorInputRef}
          type="color"
          value={value || "#000000"}
          onChange={handlePickerChange}
          className="sr-only"
          tabIndex={-1}
        />
        <input
          type="text"
          value={value}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          placeholder="#000000"
          disabled={disabled}
          className="flex-1 h-8 px-2 rounded-md bg-white/[0.06] border border-white/10 text-sm text-white font-mono placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
