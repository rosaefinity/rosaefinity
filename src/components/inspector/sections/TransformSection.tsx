import React, { useCallback } from "react";
import { InspectorSection } from "../InspectorSection";
import { NumberField } from "../fields/NumberField";
import type { Widget } from "../../../types/overlay-types";

interface TransformSectionProps {
  widget: Widget;
  onUpdate: (changes: Partial<Omit<Widget, "id">>) => void;
}

export function TransformSection({ widget, onUpdate }: TransformSectionProps): React.JSX.Element {
  const handleXChange = useCallback(
    (x: number) => onUpdate({ x }),
    [onUpdate],
  );

  const handleYChange = useCallback(
    (y: number) => onUpdate({ y }),
    [onUpdate],
  );

  const handleWidthChange = useCallback(
    (width: number) => onUpdate({ width: Math.max(10, width) }),
    [onUpdate],
  );

  const handleHeightChange = useCallback(
    (height: number) => onUpdate({ height: Math.max(10, height) }),
    [onUpdate],
  );

  const handleRotationChange = useCallback(
    (rotation: number) => onUpdate({ rotation }),
    [onUpdate],
  );

  return (
    <InspectorSection title="Transform">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={widget.x} onChange={handleXChange} step={1} />
        <NumberField label="Y" value={widget.y} onChange={handleYChange} step={1} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Width" value={widget.width} onChange={handleWidthChange} min={10} step={1} />
        <NumberField label="Height" value={widget.height} onChange={handleHeightChange} min={10} step={1} />
      </div>
      <NumberField
        label="Rotation"
        value={widget.rotation}
        onChange={handleRotationChange}
        min={0}
        max={360}
        step={1}
      />
    </InspectorSection>
  );
}
