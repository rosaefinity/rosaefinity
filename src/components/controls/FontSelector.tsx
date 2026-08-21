import React, { useCallback, memo } from 'react';
import { cn } from '../../lib/utils';
import { ControlRow } from './ControlRow';

const FONT_OPTIONS = [
  { value: "'Segoe UI', system-ui, sans-serif", label: 'Segoe UI' },
  { value: "'Inter', system-ui, sans-serif", label: 'Inter' },
  { value: "'Roboto', system-ui, sans-serif", label: 'Roboto' },
  { value: "'Open Sans', system-ui, sans-serif", label: 'Open Sans' },
  { value: "'Lato', system-ui, sans-serif", label: 'Lato' },
  { value: "'Montserrat', system-ui, sans-serif", label: 'Montserrat' },
  { value: "'Poppins', system-ui, sans-serif", label: 'Poppins' },
  { value: "'Nunito', system-ui, sans-serif", label: 'Nunito' },
  { value: "'Raleway', system-ui, sans-serif", label: 'Raleway' },
  { value: "'Oswald', system-ui, sans-serif", label: 'Oswald' },
  { value: "'Bebas Neue', system-ui, sans-serif", label: 'Bebas Neue' },
  { value: "'Permanent Marker', cursive", label: 'Permanent Marker' },
  { value: "'Press Start 2P', monospace", label: 'Press Start 2P' },
  { value: "'Fira Code', monospace", label: 'Fira Code' },
  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: "system-ui, sans-serif", label: 'System Default' },
];

const SELECT_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

interface FontSelectorProps {
  label: string;
  description?: string;
  tooltip?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  defaultValue?: string;
  onReset?: () => void;
  className?: string;
}

function FontSelectorInner({
  label,
  description,
  tooltip,
  value,
  onChange,
  disabled = false,
  compact = false,
  fullWidth = false,
  defaultValue,
  onReset,
  className,
}: FontSelectorProps): React.ReactElement {
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
        {FONT_OPTIONS.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className="bg-[#1a1a2e] text-white"
            style={{ fontFamily: opt.value }}
          >
            {opt.label}
          </option>
        ))}
      </select>
    </ControlRow>
  );
}

export const FontSelector = memo(FontSelectorInner);
FontSelector.displayName = 'FontSelector';
