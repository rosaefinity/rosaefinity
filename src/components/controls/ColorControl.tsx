import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { cn } from '../../lib/utils';
import { ControlRow } from './ControlRow';

interface ColorControlProps {
  label: string;
  description?: string;
  tooltip?: string;
  value: string;
  onChange: (value: string) => void;
  onCommit?: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  defaultValue?: string;
  onReset?: () => void;
  className?: string;
}

const HEX_RE = /^#[0-9a-fA-F]{0,6}$/;

function toHex6(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return hex;
}

function ColorControlInner({
  label,
  description,
  tooltip,
  value,
  onChange,
  onCommit,
  disabled = false,
  compact = false,
  fullWidth = false,
  defaultValue,
  onReset,
  className,
}: ColorControlProps): React.ReactElement {
  const [hex, setHex] = useState(value);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHex(value);
  }, [value]);

  const handleHexChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const prefixed = raw.startsWith('#') ? raw : '#' + raw;
    if (HEX_RE.test(prefixed)) {
      setHex(prefixed);
      onChange(prefixed);
    }
  }, [onChange]);

  const handleHexBlur = useCallback(() => {
    const expanded = toHex6(hex);
    setHex(expanded);
    onCommit?.(expanded);
  }, [hex, onCommit]);

  const handleSwatchClick = useCallback(() => {
    hiddenRef.current?.click();
  }, []);

  const handleNativeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHex(val);
    onChange(val);
    onCommit?.(val);
  }, [onChange, onCommit]);

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
      <div className="flex items-center gap-2 w-full">
        <button
          type="button"
          onClick={handleSwatchClick}
          disabled={disabled}
          aria-label={`Pick color for ${label}`}
          className={cn(
            'w-8 h-8 rounded-md border border-white/10 shrink-0',
            'cursor-pointer transition-opacity',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          style={{ backgroundColor: hex }}
        >
          <input
            ref={hiddenRef}
            type="color"
            value={hex}
            onChange={handleNativeChange}
            className="sr-only"
            tabIndex={-1}
          />
        </button>
        <input
          type="text"
          value={hex}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          disabled={disabled}
          aria-label={`Color value for ${label}`}
          placeholder="#000000"
          className={cn(
            'flex-1 h-8 px-2 rounded-md text-sm text-white font-mono',
            'bg-white/[0.06] border border-white/10',
            'placeholder:text-white/30',
            'focus:outline-none focus:ring-1 focus:ring-primary/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        />
      </div>
    </ControlRow>
  );
}

export const ColorControl = memo(ColorControlInner);
ColorControl.displayName = 'ColorControl';
