import React, { useCallback, useState } from "react";
import { cn } from "../../lib/utils";

interface InspectorSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function InspectorSection({
  title,
  defaultOpen = true,
  children,
  className,
}: InspectorSectionProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return (
    <div className={cn("border-b border-white/[0.06]", className)}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/[0.03] transition-colors duration-150"
      >
        <span>{title}</span>
        <svg
          className={cn("w-3 h-3 transition-transform duration-200", isOpen && "rotate-90")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {isOpen && <div className="px-3 pb-3 flex flex-col gap-3">{children}</div>}
    </div>
  );
}
