import type { Command } from "../command";
import type { OverlayEngine } from "../../overlay/overlay-engine";
import type { Widget } from "../../types/overlay-types";

let counter = 0;

export class CreateWidgetCommand implements Command {
  readonly id: string;
  readonly type = "CreateWidget";
  readonly description: string;

  private engine: OverlayEngine;
  private overlayId: string;
  private sceneId: string;
  private widgetType: string;
  private config: Partial<Widget> | undefined;
  private executed = false;
  private createdWidget: Widget | null = null;

  constructor(engine: OverlayEngine, overlayId: string, sceneId: string, widgetType: string, config?: Partial<Widget>) {
    this.id = `cmd_${Date.now().toString(36)}_${++counter}`;
    this.engine = engine;
    this.overlayId = overlayId;
    this.sceneId = sceneId;
    this.widgetType = widgetType;
    this.config = config;
    this.description = `Create ${widgetType} widget`;
  }

  execute(): void {
    if (this.executed) throw new Error("[CreateWidgetCommand] Already executed");
    this.createdWidget = this.engine.createWidget(this.overlayId, this.sceneId, this.widgetType, this.config);
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) throw new Error("[CreateWidgetCommand] Not yet executed");
    if (this.createdWidget) {
      this.engine.deleteWidget(this.overlayId, this.sceneId, this.createdWidget.id);
    }
    this.executed = false;
  }

  redo(): void {
    if (this.executed) throw new Error("[CreateWidgetCommand] Already executed");
    if (this.createdWidget) {
      this.createdWidget = this.engine.createWidget(this.overlayId, this.sceneId, this.widgetType, this.config);
    }
    this.executed = true;
  }
}
