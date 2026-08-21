import React, { useState, useCallback, memo } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** Reset all values in this section */
  onReset?: () => void;
  /** Whether any value in this section differs from default */
  isDirty?: boolean;
  /** Default open state */
  defaultOpen?: boolean;
  /** Additional className */
  className?: string;
}

function SectionCardInner({
  title,
  icon,
  children,
  onReset,
  isDirty = false,
  defaultOpen = true,
  className,
}: SectionCardProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.06] bg-[#18181f] overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 text-left min-w-0 flex-1"
          aria-expanded={isOpen}
          aria-controls={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
        >
          {icon && (
            <span className="text-white/40 shrink-0">{icon}</span>
          )}
          <span className="text-sm font-semibold text-white/80 truncate">
            {title}
          </span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-white/30 shrink-0 transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </button>

        {onReset && isDirty && (
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 px-2 py-1 text-[10px] text-white/30 hover:text-white/60 hover:bg-white/[0.06] rounded transition-colors"
            title={`Reset ${title}`}
            aria-label={`Reset all ${title} settings`}
          >
            Reset
          </button>
        )}
      </div>

      {/* Content */}
      <div
        id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
        role="region"
        aria-labelledby={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="px-4 pb-4 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}

export const SectionCard = memo(SectionCardInner);
SectionCard.displayName = 'SectionCard';
