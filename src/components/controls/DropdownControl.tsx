import React, { useCallback, memo } from 'react';
import { cn } from '../../lib/utils';
import { ControlRow } from './ControlRow';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownControlProps {
  label: string;
  description?: string;
  tooltip?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  defaultValue?: string;
  onReset?: () => void;
  className?: string;
}

const SELECT_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

function DropdownControlInner({
  label,
  description,
  tooltip,
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
  fullWidth = false,
  defaultValue,
  onReset,
  className,
}: DropdownControlProps): React.ReactElement {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  }, [onChange]);

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
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'w-full h-8 px-2 pr-7 rounded-md text-sm text-white',
          'bg-white/[0.06] border border-white/10',
          'focus:outline-none focus:ring-1 focus:ring-primary/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'appearance-none cursor-pointer',
        )}
        style={{
          backgroundImage: SELECT_BG,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#1a1a2e] text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </ControlRow>
  );
}

export const DropdownControl = memo(DropdownControlInner);
DropdownControl.displayName = 'DropdownControl';
