// =============================================
// InspectorPanel — Container for editing selected
// widget properties. Renders collapsible sections
// for general, transform, appearance, layer,
// and widget-specific fields.
// =============================================

import React from "react";
import { useInspector } from "./use-inspector";
import { GeneralSection } from "./sections/GeneralSection";
import { TransformSection } from "./sections/TransformSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { LayerSection } from "./sections/LayerSection";
import { WidgetSpecificSection } from "./sections/WidgetSpecificSection";
import type { EditorInstance, EditorSnapshot } from "../../hooks/use-editor";

interface InspectorPanelProps {
  instance: EditorInstance;
  snapshot: EditorSnapshot;
}

export function InspectorPanel({ instance, snapshot }: InspectorPanelProps): JSX.Element {
  const {
    selectedWidget,
    selectedWidgets,
    selectionMode,
    updateWidget,
    executeLayerCommand,
  } = useInspector(instance, snapshot);

  // Disabled state — nothing selected
  if (selectionMode === "none") {
    return (
      <div className="w-[300px] border-l border-white/[0.06] bg-[#0d0d14] flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <svg
            className="w-10 h-10 mx-auto mb-3 text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
            />
          </svg>
          <p className="text-xs text-white/30 leading-relaxed">
            Select a widget to edit its properties
          </p>
        </div>
      </div>
    );
  }

  // Multi-selection state
  if (selectionMode === "multi") {
    return (
      <div className="w-[300px] border-l border-white/[0.06] bg-[#0d0d14] flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <p className="text-xs text-white/50">
            {selectedWidgets.length} widgets selected
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">
            Multi-edit not yet supported. Click a single widget to edit.
          </p>
        </div>
      </div>
    );
  }

  // Single selection — full inspector
  if (!selectedWidget) return null;

  const handleUpdate = (changes: Record<string, unknown>) => {
    updateWidget(selectedWidget.id, changes);
  };

  return (
    <div className="w-[300px] border-l border-white/[0.06] bg-[#0d0d14] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <h3 className="text-xs font-semibold text-white/70">Inspector</h3>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto">
        <GeneralSection widget={selectedWidget} onUpdate={handleUpdate} />
        <TransformSection widget={selectedWidget} onUpdate={handleUpdate} />
        <AppearanceSection widget={selectedWidget} onUpdate={handleUpdate} />
        <LayerSection
          widget={selectedWidget}
          onUpdate={handleUpdate}
          onLayerCommand={executeLayerCommand}
        />
        <WidgetSpecificSection widget={selectedWidget} onUpdate={handleUpdate} />
      </div>
    </div>
  );
}
