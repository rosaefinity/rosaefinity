import React, { memo } from 'react';
import { cn } from '../../lib/utils';

interface LabelProps {
  /** Label text */
  label: string;
  /** Optional description shown below label */
  description?: string;
  /** Tooltip text (title attribute) */
  tooltip?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Render as compact (smaller text) */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

function LabelInner({
  label,
  description,
  tooltip,
  disabled = false,
  compact = false,
  className,
}: LabelProps): React.ReactElement {
  return (
    <div className={cn('flex flex-col', className)}>
      <span
        className={cn(
          'font-medium text-white/50 select-none',
          compact ? 'text-[10px]' : 'text-xs',
          disabled && 'opacity-50',
        )}
        title={tooltip || label}
      >
        {label}
      </span>
      {description && (
        <span className="text-[10px] text-white/30 mt-0.5">
          {description}
        </span>
      )}
    </div>
  );
}

export const Label = memo(LabelInner);
Label.displayName = 'Label';
