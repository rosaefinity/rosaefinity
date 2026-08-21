import type { Command } from "../command";
import type { OverlayEngine } from "../../overlay/overlay-engine";
import type { Widget } from "../../types/overlay-types";

let counter = 0;

export class DeleteWidgetCommand implements Command {
  readonly id: string;
  readonly type = "DeleteWidget";
  readonly description: string;

  private engine: OverlayEngine;
  private overlayId: string;
  private sceneId: string;
  private widgetId: string;
  private executed = false;
  private deletedWidget: Widget | null = null;
  private recreatedWidgetId: string | null = null;

  constructor(engine: OverlayEngine, overlayId: string, sceneId: string, widgetId: string) {
    this.id = `cmd_${Date.now().toString(36)}_${++counter}`;
    this.engine = engine;
    this.overlayId = overlayId;
    this.sceneId = sceneId;
    this.widgetId = widgetId;
    this.description = `Delete widget`;
  }

  execute(): void {
    if (this.executed) throw new Error("[DeleteWidgetCommand] Already executed");
    const widget = this.engine.getWidget(this.overlayId, this.sceneId, this.widgetId);
    if (!widget) throw new Error(`[DeleteWidgetCommand] Widget not found: "${this.widgetId}"`);
    this.deletedWidget = JSON.parse(JSON.stringify(widget));
    this.engine.deleteWidget(this.overlayId, this.sceneId, this.widgetId);
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) throw new Error("[DeleteWidgetCommand] Not yet executed");
    if (this.deletedWidget) {
      const recreated = this.engine.createWidget(this.overlayId, this.sceneId, this.deletedWidget.type, {
        x: this.deletedWidget.x,
        y: this.deletedWidget.y,
        width: this.deletedWidget.width,
        height: this.deletedWidget.height,
        rotation: this.deletedWidget.rotation,
        zIndex: this.deletedWidget.zIndex,
        locked: this.deletedWidget.locked,
        visible: this.deletedWidget.visible,
        groupId: this.deletedWidget.groupId,
        props: this.deletedWidget.props,
        animations: this.deletedWidget.animations,
      });
      this.recreatedWidgetId = recreated.id;
    }
    this.executed = false;
  }

  redo(): void {
    if (this.executed) throw new Error("[DeleteWidgetCommand] Already executed");
    const idToDelete = this.recreatedWidgetId || this.widgetId;
    this.engine.deleteWidget(this.overlayId, this.sceneId, idToDelete);
    this.executed = true;
  }
}
