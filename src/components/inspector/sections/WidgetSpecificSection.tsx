import React, { useCallback } from "react";
import { InspectorSection } from "../InspectorSection";
import { StringField } from "../fields/StringField";
import { NumberField } from "../fields/NumberField";
import { BooleanField } from "../fields/BooleanField";
import { SelectField } from "../fields/SelectField";
import { ColorField } from "../fields/ColorField";
import { AlignmentField } from "../fields/AlignmentField";
import type { Widget } from "../../../types/overlay-types";
import type { TextWidgetProps, ImageWidgetProps, BrowserWidgetProps, VideoWidgetProps } from "../../../types/overlay-types";

interface WidgetSpecificSectionProps {
  widget: Widget;
  onUpdate: (changes: Partial<Omit<Widget, "id">>) => void;
}

export function WidgetSpecificSection({ widget, onUpdate }: WidgetSpecificSectionProps): React.JSX.Element | null {
  const updateProp = useCallback(
    (key: string, value: unknown) => {
      onUpdate({ props: { ...widget.props, [key]: value } });
    },
    [widget.props, onUpdate],
  );

  switch (widget.type) {
    case "text":
      return <TextWidgetFields widget={widget} updateProp={updateProp} />;
    case "image":
      return <ImageWidgetFields widget={widget} updateProp={updateProp} />;
    case "browser":
      return <BrowserWidgetFields widget={widget} updateProp={updateProp} />;
    case "video":
      return <VideoWidgetFields widget={widget} updateProp={updateProp} />;
    default:
      return (
        <InspectorSection title="Properties">
          <p className="text-xs text-white/30">No specific properties for this widget type.</p>
        </InspectorSection>
      );
  }
}

function TextWidgetFields({
  widget,
  updateProp,
}: {
  widget: Widget;
  updateProp: (key: string, value: unknown) => void;
}): React.JSX.Element {
  const props = widget.props as TextWidgetProps;

  return (
    <InspectorSection title="Text Properties">
      <StringField
        label="Text"
        value={props.text || ""}
        onChange={(v) => updateProp("text", v)}
        placeholder="Enter text..."
      />
      <StringField
        label="Font Family"
        value={props.fontFamily || "Inter, sans-serif"}
        onChange={(v) => updateProp("fontFamily", v)}
      />
      <NumberField
        label="Font Size"
        value={props.fontSize || 24}
        onChange={(v) => updateProp("fontSize", v)}
        min={1}
        max={200}
        step={1}
      />
      <SelectField
        label="Font Weight"
        value={props.fontWeight || "normal"}
        options={[
          { value: "normal", label: "Normal" },
          { value: "bold", label: "Bold" },
          { value: "100", label: "Thin" },
          { value: "300", label: "Light" },
          { value: "500", label: "Medium" },
          { value: "600", label: "Semi Bold" },
          { value: "800", label: "Extra Bold" },
          { value: "900", label: "Black" },
        ]}
        onChange={(v) => updateProp("fontWeight", v)}
      />
      <AlignmentField
        label="Alignment"
        value={props.textAlign || "left"}
        onChange={(v) => updateProp("textAlign", v)}
      />
      <ColorField
        label="Text Color"
        value={props.color || "#ffffff"}
        onChange={(v) => updateProp("color", v)}
      />
    </InspectorSection>
  );
}

function ImageWidgetFields({
  widget,
  updateProp,
}: {
  widget: Widget;
  updateProp: (key: string, value: unknown) => void;
}): React.JSX.Element {
  const props = widget.props as ImageWidgetProps;

  return (
    <InspectorSection title="Image Properties">
      <StringField
        label="Source URL"
        value={props.src || ""}
        onChange={(v) => updateProp("src", v)}
        placeholder="https://..."
      />
      <SelectField
        label="Fit Mode"
        value={props.fit || "cover"}
        options={[
          { value: "cover", label: "Cover" },
          { value: "contain", label: "Contain" },
          { value: "fill", label: "Fill" },
          { value: "none", label: "None" },
        ]}
        onChange={(v) => updateProp("fit", v)}
      />
    </InspectorSection>
  );
}

function BrowserWidgetFields({
  widget,
  updateProp,
}: {
  widget: Widget;
  updateProp: (key: string, value: unknown) => void;
}): React.JSX.Element {
  const props = widget.props as BrowserWidgetProps;

  return (
    <InspectorSection title="Browser Properties">
      <StringField
        label="URL"
        value={props.url || ""}
        onChange={(v) => updateProp("url", v)}
        placeholder="https://..."
      />
    </InspectorSection>
  );
}

function VideoWidgetFields({
  widget,
  updateProp,
}: {
  widget: Widget;
  updateProp: (key: string, value: unknown) => void;
}): React.JSX.Element {
  const props = widget.props as VideoWidgetProps;

  return (
    <InspectorSection title="Video Properties">
      <StringField
        label="Source URL"
        value={props.src || ""}
        onChange={(v) => updateProp("src", v)}
        placeholder="https://..."
      />
      <BooleanField
        label="Autoplay"
        value={props.autoplay || false}
        onChange={(v) => updateProp("autoplay", v)}
      />
      <BooleanField
        label="Loop"
        value={props.loop || false}
        onChange={(v) => updateProp("loop", v)}
      />
    </InspectorSection>
  );
}
