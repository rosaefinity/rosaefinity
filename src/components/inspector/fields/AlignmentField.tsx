import React from "react";

type TextAlign = "left" | "center" | "right" | "justify";

interface AlignmentFieldProps {
  label: string;
  value: TextAlign;
  onChange: (value: TextAlign) => void;
  disabled?: boolean;
}

const ALIGNMENTS: { value: TextAlign; icon: string; label: string }[] = [
  { value: "left", icon: "⫷", label: "Left" },
  { value: "center", icon: "☰", label: "Center" },
  { value: "right", icon: "⫸", label: "Right" },
  { value: "justify", icon: "☐", label: "Justify" },
];

export function AlignmentField({ label, value, onChange, disabled }: AlignmentFieldProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-white/50 font-medium">{label}</label>
      <div className="flex gap-1">
        {ALIGNMENTS.map((align) => (
          <button
            key={align.value}
            type="button"
            onClick={() => onChange(align.value)}
            disabled={disabled}
            title={align.label}
            className={`flex-1 h-8 rounded-md text-sm font-medium transition-colors duration-150 ${
              value === align.value
                ? "bg-primary text-white"
                : "bg-white/[0.06] text-white/50 hover:bg-white/10 hover:text-white"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {align.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
