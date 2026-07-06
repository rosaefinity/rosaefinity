import React, { useCallback } from "react";
import { InspectorSection } from "../InspectorSection";
import { StringField } from "../fields/StringField";
import { BooleanField } from "../fields/BooleanField";
import type { Widget } from "../../../types/overlay-types";

interface GeneralSectionProps {
  widget: Widget;
  onUpdate: (changes: Partial<Omit<Widget, "id">>) => void;
}

const WIDGET_TYPE_LABELS: Record<string, string> = {
  "alert-card": "Alert Card",
  text: "Text",
  image: "Image",
  video: "Video",
  browser: "Browser",
  "alert-sound": "Alert Sound",
  "alert-text": "Alert Text",
  "goal-bar": "Goal Bar",
  "chat-box": "Chat Box",
  "donation-goal": "Donation Goal",
  "event-list": "Event List",
  "follow-goal": "Follow Goal",
  "media-player": "Media Player",
  "stream-label": "Stream Label",
  timer: "Timer",
  webcam: "Webcam",
};

export function GeneralSection({ widget, onUpdate }: GeneralSectionProps): JSX.Element {
  const handleNameChange = useCallback(
    (name: string) => {
      onUpdate({ props: { ...widget.props, name } });
    },
    [widget.props, onUpdate],
  );

  const handleVisibleChange = useCallback(
    (visible: boolean) => {
      onUpdate({ visible });
    },
    [onUpdate],
  );

  const handleLockedChange = useCallback(
    (locked: boolean) => {
      onUpdate({ locked });
    },
    [onUpdate],
  );

  const typeLabel = WIDGET_TYPE_LABELS[widget.type] || widget.type;

  return (
    <InspectorSection title="General">
      <StringField
        label="Name"
        value={(widget.props.name as string) || typeLabel}
        onChange={handleNameChange}
        placeholder="Widget name"
      />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-white/50 font-medium">Type</label>
        <div className="h-8 px-2 rounded-md bg-white/[0.03] border border-white/[0.06] flex items-center">
          <span className="text-xs text-white/40">{typeLabel}</span>
        </div>
      </div>
      <BooleanField
        label="Visible"
        value={widget.visible}
        onChange={handleVisibleChange}
      />
      <BooleanField
        label="Locked"
        value={widget.locked}
        onChange={handleLockedChange}
      />
    </InspectorSection>
  );
}
