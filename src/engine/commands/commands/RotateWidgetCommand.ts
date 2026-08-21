import type { Command } from "../command";
import type { OverlayEngine } from "../../overlay/overlay-engine";

let counter = 0;

export class RotateWidgetCommand implements Command {
  readonly id: string;
  readonly type = "RotateWidget";
  readonly description: string;

  private engine: OverlayEngine;
  private overlayId: string;
  private sceneId: string;
  private widgetId: string;
  private newAngle: number;
  private executed = false;
  private oldAngle = 0;

  constructor(engine: OverlayEngine, overlayId: string, sceneId: string, widgetId: string, newAngle: number) {
    if (typeof newAngle !== "number" || Number.isNaN(newAngle) || !Number.isFinite(newAngle)) {
      throw new Error("[RotateWidgetCommand] newAngle must be a finite number");
    }
    this.id = `cmd_${Date.now().toString(36)}_${++counter}`;
    this.engine = engine;
    this.overlayId = overlayId;
    this.sceneId = sceneId;
    this.widgetId = widgetId;
    this.newAngle = newAngle;
    this.description = `Rotate widget to ${Math.round(newAngle)}°`;
  }

  execute(): void {
    if (this.executed) throw new Error("[RotateWidgetCommand] Already executed");
    const widget = this.engine.getWidget(this.overlayId, this.sceneId, this.widgetId);
    if (!widget) throw new Error(`[RotateWidgetCommand] Widget not found: "${this.widgetId}"`);
    this.oldAngle = widget.rotation;
    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, { rotation: this.newAngle });
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) throw new Error("[RotateWidgetCommand] Not yet executed");
    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, { rotation: this.oldAngle });
    this.executed = false;
  }

  redo(): void {
    if (this.executed) throw new Error("[RotateWidgetCommand] Already executed");
    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, { rotation: this.newAngle });
    this.executed = true;
  }
}
