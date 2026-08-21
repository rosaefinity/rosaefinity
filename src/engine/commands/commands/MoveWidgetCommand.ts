import type { Command } from "../command";
import type { OverlayEngine } from "../../overlay/overlay-engine";

let counter = 0;

export class MoveWidgetCommand implements Command {
  readonly id: string;
  readonly type = "MoveWidget";
  readonly description: string;

  private engine: OverlayEngine;
  private overlayId: string;
  private sceneId: string;
  private widgetId: string;
  private newX: number;
  private newY: number;
  private executed = false;
  private oldX = 0;
  private oldY = 0;

  constructor(engine: OverlayEngine, overlayId: string, sceneId: string, widgetId: string, newX: number, newY: number) {
    if (typeof newX !== "number" || Number.isNaN(newX) || !Number.isFinite(newX)) {
      throw new Error("[MoveWidgetCommand] newX must be a finite number");
    }
    if (typeof newY !== "number" || Number.isNaN(newY) || !Number.isFinite(newY)) {
      throw new Error("[MoveWidgetCommand] newY must be a finite number");
    }
    this.id = `cmd_${Date.now().toString(36)}_${++counter}`;
    this.engine = engine;
    this.overlayId = overlayId;
    this.sceneId = sceneId;
    this.widgetId = widgetId;
    this.newX = newX;
    this.newY = newY;
    this.description = `Move widget to (${Math.round(newX)}, ${Math.round(newY)})`;
  }

  execute(): void {
    if (this.executed) throw new Error("[MoveWidgetCommand] Already executed");
    const widget = this.engine.getWidget(this.overlayId, this.sceneId, this.widgetId);
    if (!widget) throw new Error(`[MoveWidgetCommand] Widget not found: "${this.widgetId}"`);
    this.oldX = widget.x;
    this.oldY = widget.y;
    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, { x: this.newX, y: this.newY });
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) throw new Error("[MoveWidgetCommand] Not yet executed");
    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, { x: this.oldX, y: this.oldY });
    this.executed = false;
  }

  redo(): void {
    if (this.executed) throw new Error("[MoveWidgetCommand] Already executed");
    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, { x: this.newX, y: this.newY });
    this.executed = true;
  }
}
