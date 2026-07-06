// =============================================
// Inspector Types — Types for the Property Inspector
// =============================================

import type { Widget, WidgetGroup } from "../../types/overlay-types";

export interface InspectorState {
  widget: Widget | null;
  widgetTypeConfig: WidgetTypeConfig;
}

export type WidgetType =
  | "alert-card"
  | "text"
  | "image"
  | "video"
  | "browser"
  | "alert-sound"
  | "alert-text"
  | "goal-bar"
  | "chat-box"
  | "donation-goal"
  | "event-list"
  | "follow-goal"
  | "media-player"
  | "stream-label"
  | "timer"
  | "webcam";

export interface WidgetTypeConfig {
  type: WidgetType;
  label: string;
  icon: string;
  properties: PropertyDefinition[];
}

export interface PropertyDefinition {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "color" | "select" | "range" | "url" | "font" | "font-size" | "alignment";
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  required?: boolean;
}

/** Layer reorder command types */
export type LayerCommand = "bring-forward" | "send-backward" | "bring-to-front" | "send-to-back";

/** Selection mode for the inspector */
export type SelectionMode = "none" | "single" | "multi";

/** Inspector props — strongly typed, no any */
export interface InspectorProps {
  widget: Widget | null;
  selectedWidgets: Widget[];
  selectionMode: SelectionMode;
  onUpdate: (changes: Record<string, unknown>) => void;
  onLayerCommand: (command: LayerCommand) => void;
  isEnabled: boolean;
}