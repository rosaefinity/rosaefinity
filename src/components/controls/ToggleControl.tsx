import React, { useCallback, memo } from 'react';
import { cn } from '../../lib/utils';
import { ControlRow } from './ControlRow';

interface ToggleControlProps {
  label: string;
  description?: string;
  tooltip?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  defaultValue?: boolean;
  onReset?: () => void;
  className?: string;
}

function ToggleControlInner({
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
}: ToggleControlProps): React.ReactElement {
  const handleToggle = useCallback(() => {
    if (!disabled) onChange(!value);
  }, [value, onChange, disabled]);

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
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full',
          'border-2 border-transparent transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          value ? 'bg-primary' : 'bg-white/20',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg',
            'transition-transform duration-200',
            value ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </ControlRow>
  );
}

export const ToggleControl = memo(ToggleControlInner);
ToggleControl.displayName = 'ToggleControl';
