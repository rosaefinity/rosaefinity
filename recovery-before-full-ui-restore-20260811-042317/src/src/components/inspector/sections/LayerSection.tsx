import React, { useCallback } from "react";
import { InspectorSection } from "../InspectorSection";
import { NumberField } from "../fields/NumberField";
import type { Widget } from "../../../types/overlay-types";
import type { LayerCommand } from "../../../engine/inspector/inspector-types";

interface LayerSectionProps {
  widget: Widget;
  onUpdate: (changes: Partial<Omit<Widget, "id">>) => void;
  onLayerCommand: (command: LayerCommand) => void;
}

export function LayerSection({ widget, onUpdate, onLayerCommand }: LayerSectionProps): JSX.Element {
  const handleZIndexChange = useCallback(
    (zIndex: number) => onUpdate({ zIndex: Math.round(zIndex) }),
    [onUpdate],
  );

  const buttons: { command: LayerCommand; label: string; icon: string }[] = [
    { command: "bring-forward", label: "Forward", icon: "↑" },
    { command: "send-backward", label: "Backward", icon: "↓" },
    { command: "bring-to-front", label: "Front", icon: "⤒" },
    { command: "send-to-back", label: "Back", icon: "⤓" },
  ];

  return (
    <InspectorSection title="Layer">
      <NumberField
        label="Z-Index"
        value={widget.zIndex}
        onChange={handleZIndexChange}
        step={1}
      />
      <div className="grid grid-cols-4 gap-1">
        {buttons.map((btn) => (
          <button
            key={btn.command}
            type="button"
            onClick={() => onLayerCommand(btn.command)}
            title={btn.label}
            className="h-8 rounded-md bg-white/[0.06] border border-white/10 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors duration-150 flex items-center justify-center"
          >
            {btn.icon}
          </button>
        ))}
      </div>
    </InspectorSection>
  );
}
