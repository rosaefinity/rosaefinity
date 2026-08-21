// =============================================
// Clipboard Manager — Handles copy/cut/paste
// of widget data with deep cloning and ID
// regeneration.
// =============================================

import type { OverlayEngine } from "../overlay/overlay-engine";
import type { CommandManager } from "../commands/command-manager";
import type { SelectionManager } from "../editor/selection-manager";
import type { Widget } from "../../types/overlay-types";
import type { ClipboardSnapshot, ClipboardWidgetData } from "./clipboard-types";
import { clipboardEvents } from "./clipboard-events";
import { CreateWidgetCommand } from "../commands/commands/CreateWidgetCommand";
import { DeleteWidgetCommand } from "../commands/commands/DeleteWidgetCommand";

const PASTE_OFFSET = 20;

export class ClipboardManager {
  private engine: OverlayEngine;
  private commandManager: CommandManager;
  private selection: SelectionManager;
  private snapshot: ClipboardSnapshot | null = null;
  private pasteCount = 0;

  constructor(
    engine: OverlayEngine,
    commandManager: CommandManager,
    selection: SelectionManager,
  ) {
    this.engine = engine;
    this.commandManager = commandManager;
    this.selection = selection;
  }

  /**
   * Copy the currently selected widgets.
   * Stores deep-cloned widget data with original IDs.
   */
  copy(overlayId: string, sceneId: string): number {
    const selectedIds = this.selection.getSelectedWidgetIds();
    if (selectedIds.length === 0) return 0;

    const widgets: Widget[] = [];
    const widgetData: ClipboardWidgetData[] = [];

    for (const id of selectedIds) {
      const widget = this.engine.getWidget(overlayId, sceneId, id);
      if (!widget) continue;
      widgets.push(JSON.parse(JSON.stringify(widget)));
      widgetData.push({
        id: widget.id,
        originalId: widget.id,
        offsetX: 0,
        offsetY: 0,
      });
    }

    this.snapshot = {
      widgets,
      widgetData,
      sourceOverlayId: overlayId,
      sourceSceneId: sceneId,
      pasteCount: 0,
    };

    clipboardEvents.emit("clipboard:copy", {
      widgetIds: selectedIds,
      count: widgets.length,
    });

    return widgets.length;
  }

  /**
   * Cut the currently selected widgets.
   * Copies them, then deletes originals via commands.
   */
  cut(overlayId: string, sceneId: string): number {
    const count = this.copy(overlayId, sceneId);
    if (count === 0) return 0;

    const selectedIds = this.selection.getSelectedWidgetIds();
    for (const id of selectedIds) {
      const widget = this.engine.getWidget(overlayId, sceneId, id);
      if (!widget) continue;
      this.commandManager.execute(
        new DeleteWidgetCommand(this.engine, overlayId, sceneId, id),
      );
    }
    this.selection.clearSelection();

    clipboardEvents.emit("clipboard:cut", {
      widgetIds: selectedIds,
      count,
    });

    return count;
  }

  /**
   * Paste widgets from clipboard into the target scene.
   * Creates new widget instances with regenerated IDs and offset positions.
   * Returns the IDs of newly created widgets.
   */
  paste(overlayId: string, sceneId: string): string[] {
    if (!this.snapshot || this.snapshot.widgets.length === 0) return [];

    this.pasteCount++;
    const offset = PASTE_OFFSET * this.pasteCount;
    const createdIds: string[] = [];

    for (const widget of this.snapshot.widgets) {
      const cmd = new CreateWidgetCommand(this.engine, overlayId, sceneId, widget.type, {
        x: widget.x + offset,
        y: widget.y + offset,
        width: widget.width,
        height: widget.height,
        rotation: widget.rotation,
        zIndex: widget.zIndex,
        locked: false,
        visible: widget.visible,
        props: JSON.parse(JSON.stringify(widget.props)),
        animations: JSON.parse(JSON.stringify(widget.animations)),
      });
      this.commandManager.execute(cmd);

      // Find the newly created widget (last in scene)
      const scene = this.engine.getScene(overlayId, sceneId);
      if (scene && scene.widgets.length > 0) {
        createdIds.push(scene.widgets[scene.widgets.length - 1].id);
      }
    }

    // Select newly pasted widgets
    if (createdIds.length > 0) {
      this.selection.selectWidgets(createdIds);
    }

    this.snapshot.pasteCount = this.pasteCount;

    clipboardEvents.emit("clipboard:paste", {
      widgetIds: createdIds,
      count: createdIds.length,
    });

    return createdIds;
  }

  /**
   * Clear the clipboard.
   */
  clear(): void {
    this.snapshot = null;
    this.pasteCount = 0;
  }

  /**
   * Check if clipboard has content.
   */
  hasContent(): boolean {
    return this.snapshot !== null && this.snapshot.widgets.length > 0;
  }

  /**
   * Get the number of widgets in the clipboard.
   */
  getCount(): number {
    return this.snapshot?.widgets.length ?? 0;
  }

  /**
   * Get the clipboard snapshot (deep copy).
   */
  getSnapshot(): ClipboardSnapshot | null {
    return this.snapshot ? JSON.parse(JSON.stringify(this.snapshot)) : null;
  }

  /**
   * Reset paste offset counter (call when clipboard changes).
   */
  resetPasteCount(): void {
    this.pasteCount = 0;
  }
}
