import React, { memo } from 'react';
import { cn } from '../../lib/utils';

interface ControlRowProps {
  /** Label text */
  label: string;
  /** Optional description */
  description?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Full width (column layout instead of row) */
  fullWidth?: boolean;
  /** The control element(s) to render on the right */
  children: React.ReactNode;
  /** Optional reset button */
  onReset?: () => void;
  /** Whether the value differs from default (shows reset button) */
  isDirty?: boolean;
  /** Additional className for the row */
  className?: string;
}

function ControlRowInner({
  label,
  description,
  tooltip,
  disabled = false,
  compact = false,
  fullWidth = false,
  children,
  onReset,
  isDirty = false,
  className,
}: ControlRowProps): React.ReactElement {
  return (
    <div
      className={cn(
        fullWidth ? 'flex flex-col gap-1' : 'flex items-center justify-between gap-3',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            'font-medium text-white/50 select-none shrink-0',
            compact ? 'text-[10px]' : 'text-xs',
            disabled && 'opacity-50',
          )}
          title={tooltip || label}
        >
          {label}
        </span>
        {description && (
          <span className="text-[10px] text-white/30 hidden" title={description}>
            ⓘ
          </span>
        )}
      </div>

      <div className={cn('flex items-center gap-1.5', fullWidth && 'w-full')}>
        <div className={cn('flex-1 min-w-0', fullWidth && 'w-full')}>
          {children}
        </div>
        {onReset && isDirty && (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
            title={`Reset ${label}`}
            aria-label={`Reset ${label}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export const ControlRow = memo(ControlRowInner);
ControlRow.displayName = 'ControlRow';
