import type { Command } from "../command";
import type { OverlayEngine } from "../../overlay/overlay-engine";
import type { Widget } from "../../types/overlay-types";

let counter = 0;

export class DuplicateWidgetCommand implements Command {
  readonly id: string;
  readonly type = "DuplicateWidget";
  readonly description: string;

  private engine: OverlayEngine;
  private overlayId: string;
  private sceneId: string;
  private sourceWidgetId: string;
  private executed = false;
  private createdWidget: Widget | null = null;

  constructor(engine: OverlayEngine, overlayId: string, sceneId: string, sourceWidgetId: string) {
    this.id = `cmd_${Date.now().toString(36)}_${++counter}`;
    this.engine = engine;
    this.overlayId = overlayId;
    this.sceneId = sceneId;
    this.sourceWidgetId = sourceWidgetId;
    this.description = `Duplicate widget`;
  }

  execute(): void {
    if (this.executed) throw new Error("[DuplicateWidgetCommand] Already executed");
    this.createdWidget = this.engine.duplicateWidget(this.overlayId, this.sceneId, this.sourceWidgetId);
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) throw new Error("[DuplicateWidgetCommand] Not yet executed");
    if (this.createdWidget) {
      this.engine.deleteWidget(this.overlayId, this.sceneId, this.createdWidget.id);
    }
    this.executed = false;
  }

  redo(): void {
    if (this.executed) throw new Error("[DuplicateWidgetCommand] Already executed");
    if (this.createdWidget) {
      this.createdWidget = this.engine.duplicateWidget(this.overlayId, this.sceneId, this.sourceWidgetId);
    }
    this.executed = true;
  }
}
