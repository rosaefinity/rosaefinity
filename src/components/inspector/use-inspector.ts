// =============================================
// useInspector — Hook for reading selected widget(s)
// and dispatching property changes via CommandManager.
//
// Never mutates state directly. Every change goes
// through UpdateWidgetCommand for undo/redo support.
// =============================================

import { useCallback, useMemo } from 'react';
import { UpdateWidgetCommand } from '../../engine/commands/commands';
import type { EditorInstance, EditorSnapshot } from '../../hooks/use-editor';
import type { Widget } from '../../types/overlay-types';
import type { LayerCommand } from '../../engine/inspector/inspector-types';

export interface UseInspectorReturn {
  /** The primary selected widget (first selection), or null */
  selectedWidget: Widget | null;
  /** All selected widgets */
  selectedWidgets: Widget[];
  /** "none" | "single" | "multi" */
  selectionMode: 'none' | 'single' | 'multi';
  /** Update a single widget's properties via command */
  updateWidget: (widgetId: string, changes: Partial<Omit<Widget, 'id'>>) => void;
  /** Update multiple widgets' properties via individual commands */
  updateMultipleWidgets: (widgetIds: string[], changes: Partial<Omit<Widget, 'id'>>) => void;
  /** Execute a layer reorder command */
  executeLayerCommand: (command: LayerCommand) => void;
}

export function useInspector(
  instance: EditorInstance,
  snapshot: EditorSnapshot,
): UseInspectorReturn {
  const { commandManager, engine, selection } = instance;
  const { editorState: es, activeScene } = snapshot;

  // Resolve selected widgets from IDs
  const selectedWidgets = useMemo(() => {
    if (!activeScene || es.selectedWidgetIds.length === 0) return [];
    return es.selectedWidgetIds
      .map((id) => activeScene.widgets.find((w) => w.id === id))
      .filter((w): w is Widget => w !== undefined);
  }, [activeScene, es.selectedWidgetIds]);

  const selectedWidget = selectedWidgets.length === 1 ? selectedWidgets[0] : null;

  const selectionMode = es.selectedWidgetIds.length === 0
    ? 'none'
    : es.selectedWidgetIds.length === 1
      ? 'single'
      : 'multi';

  // Update a single widget via UpdateWidgetCommand
  const updateWidget = useCallback(
    (widgetId: string, changes: Partial<Omit<Widget, 'id'>>) => {
      if (!es.selectedOverlayId || !es.selectedSceneId) return;
      const cmd = new UpdateWidgetCommand(
        engine,
        es.selectedOverlayId,
        es.selectedSceneId,
        widgetId,
        changes,
      );
      commandManager.execute(cmd);
    },
    [engine, commandManager, es.selectedOverlayId, es.selectedSceneId],
  );

  // Update multiple widgets (one command per widget)
  const updateMultipleWidgets = useCallback(
    (widgetIds: string[], changes: Partial<Omit<Widget, 'id'>>) => {
      for (const id of widgetIds) {
        updateWidget(id, changes);
      }
    },
    [updateWidget],
  );

  // Execute layer reorder commands
  const executeLayerCommand = useCallback(
    (cmd: LayerCommand) => {
      if (!activeScene || selectedWidgets.length === 0) return;

      const sorted = [...activeScene.widgets].sort((a, b) => a.zIndex - b.zIndex);
      const maxZ = sorted.length > 0 ? sorted[sorted.length - 1].zIndex : 0;
      const minZ = sorted.length > 0 ? sorted[0].zIndex : 0;

      for (const widget of selectedWidgets) {
        let newZIndex = widget.zIndex;

        switch (cmd) {
          case 'bring-forward':
            newZIndex = widget.zIndex + 1;
            break;
          case 'send-backward':
            newZIndex = widget.zIndex - 1;
            break;
          case 'bring-to-front':
            newZIndex = maxZ + 1;
            break;
          case 'send-to-back':
            newZIndex = minZ - 1;
            break;
        }

        updateWidget(widget.id, { zIndex: newZIndex });
      }
    },
    [activeScene, selectedWidgets, updateWidget],
  );

  return {
    selectedWidget,
    selectedWidgets,
    selectionMode,
    updateWidget,
    updateMultipleWidgets,
    executeLayerCommand,
  };
}
