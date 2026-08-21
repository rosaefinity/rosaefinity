import type { Command } from "../command";
import type { OverlayEngine } from "../../overlay/overlay-engine";

let counter = 0;

export class ResizeWidgetCommand implements Command {
  readonly id: string;
  readonly type = "ResizeWidget";
  readonly description: string;

  private engine: OverlayEngine;
  private overlayId: string;
  private sceneId: string;
  private widgetId: string;
  private newWidth: number;
  private newHeight: number;
  private executed = false;
  private oldWidth = 0;
  private oldHeight = 0;

  constructor(engine: OverlayEngine, overlayId: string, sceneId: string, widgetId: string, newWidth: number, newHeight: number) {
    if (typeof newWidth !== "number" || Number.isNaN(newWidth) || !Number.isFinite(newWidth) || newWidth <= 0) {
      throw new Error("[ResizeWidgetCommand] newWidth must be a positive finite number");
    }
    if (typeof newHeight !== "number" || Number.isNaN(newHeight) || !Number.isFinite(newHeight) || newHeight <= 0) {
      throw new Error("[ResizeWidgetCommand] newHeight must be a positive finite number");
    }
    this.id = `cmd_${Date.now().toString(36)}_${++counter}`;
    this.engine = engine;
    this.overlayId = overlayId;
    this.sceneId = sceneId;
    this.widgetId = widgetId;
    this.newWidth = newWidth;
    this.newHeight = newHeight;
    this.description = `Resize widget to ${Math.round(newWidth)}×${Math.round(newHeight)}`;
  }

  execute(): void {
    if (this.executed) throw new Error("[ResizeWidgetCommand] Already executed");
    const widget = this.engine.getWidget(this.overlayId, this.sceneId, this.widgetId);
    if (!widget) throw new Error(`[ResizeWidgetCommand] Widget not found: "${this.widgetId}"`);
    this.oldWidth = widget.width;
    this.oldHeight = widget.height;
    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, { width: this.newWidth, height: this.newHeight });
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) throw new Error("[ResizeWidgetCommand] Not yet executed");
    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, { width: this.oldWidth, height: this.oldHeight });
    this.executed = false;
  }

  redo(): void {
    if (this.executed) throw new Error("[ResizeWidgetCommand] Already executed");
    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, { width: this.newWidth, height: this.newHeight });
    this.executed = true;
  }
}
