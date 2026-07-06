import React, { useCallback } from "react";
import { InspectorSection } from "../InspectorSection";
import { RangeField } from "../fields/RangeField";
import { ColorField } from "../fields/ColorField";
import { StringField } from "../fields/StringField";
import { NumberField } from "../fields/NumberField";
import type { Widget } from "../../../types/overlay-types";

interface AppearanceSectionProps {
  widget: Widget;
  onUpdate: (changes: Partial<Omit<Widget, "id">>) => void;
}

export function AppearanceSection({ widget, onUpdate }: AppearanceSectionProps): JSX.Element {
  const currentProps = widget.props;

  const updateProp = useCallback(
    (key: string, value: unknown) => {
      onUpdate({ props: { ...currentProps, [key]: value } });
    },
    [currentProps, onUpdate],
  );

  const opacity = (currentProps.opacity as number) ?? 1;
  const backgroundColor = (currentProps.backgroundColor as string) ?? "transparent";
  const borderRadius = (currentProps.borderRadius as number) ?? 0;
  const border = (currentProps.border as string) ?? "none";
  const boxShadow = (currentProps.boxShadow as string) ?? "none";

  return (
    <InspectorSection title="Appearance">
      <RangeField
        label="Opacity"
        value={opacity}
        onChange={(v) => updateProp("opacity", v)}
        min={0}
        max={1}
        step={0.01}
        formatValue={(v) => `${Math.round(v * 100)}%`}
      />
      <ColorField
        label="Background Color"
        value={backgroundColor}
        onChange={(v) => updateProp("backgroundColor", v)}
      />
      <NumberField
        label="Border Radius"
        value={borderRadius}
        onChange={(v) => updateProp("borderRadius", v)}
        min={0}
        step={1}
      />
      <StringField
        label="Border"
        value={border}
        onChange={(v) => updateProp("border", v)}
        placeholder="e.g. 1px solid #fff"
      />
      <StringField
        label="Box Shadow"
        value={boxShadow}
        onChange={(v) => updateProp("boxShadow", v)}
        placeholder="e.g. 0 2px 8px rgba(0,0,0,0.3)"
      />
    </InspectorSection>
  );
}
