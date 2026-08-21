import React, { useCallback } from "react";

interface BooleanFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function BooleanField({ label, value, onChange, disabled }: BooleanFieldProps): JSX.Element {
  const handleToggle = useCallback(() => {
    if (!disabled) {
      onChange(!value);
    }
  }, [value, onChange, disabled]);

  return (
    <div className="flex items-center justify-between">
      <label className="text-xs text-white/50 font-medium">{label}</label>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={handleToggle}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed ${
          value ? "bg-primary" : "bg-white/20"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
