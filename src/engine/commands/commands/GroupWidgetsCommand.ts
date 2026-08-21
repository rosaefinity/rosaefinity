import type { Command } from "../command";
import type { OverlayEngine } from "../../overlay/overlay-engine";
import type { WidgetGroup } from "../../types/overlay-types";

let counter = 0;

export class GroupWidgetsCommand implements Command {
  readonly id: string;
  readonly type = "GroupWidgets";
  readonly description: string;

  private engine: OverlayEngine;
  private overlayId: string;
  private sceneId: string;
  private widgetIds: string[];
  private groupName: string;
  private executed = false;
  private createdGroup: WidgetGroup | null = null;

  constructor(engine: OverlayEngine, overlayId: string, sceneId: string, widgetIds: string[], groupName: string) {
    if (!widgetIds || widgetIds.length < 2) {
      throw new Error("[GroupWidgetsCommand] Need at least 2 widget IDs");
    }
    if (!groupName || groupName.trim().length === 0) {
      throw new Error("[GroupWidgetsCommand] Group name cannot be empty");
    }
    this.id = `cmd_${Date.now().toString(36)}_${++counter}`;
    this.engine = engine;
    this.overlayId = overlayId;
    this.sceneId = sceneId;
    this.widgetIds = widgetIds;
    this.groupName = groupName;
    this.description = `Group ${widgetIds.length} widgets as "${groupName}"`;
  }

  execute(): void {
    if (this.executed) throw new Error("[GroupWidgetsCommand] Already executed");
    this.createdGroup = this.engine.groupWidgets(this.overlayId, this.sceneId, this.widgetIds, this.groupName);
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) throw new Error("[GroupWidgetsCommand] Not yet executed");
    if (this.createdGroup) {
      this.engine.ungroupWidgets(this.overlayId, this.sceneId, this.createdGroup.id);
    }
    this.executed = false;
  }

  redo(): void {
    if (this.executed) throw new Error("[GroupWidgetsCommand] Already executed");
    if (this.createdGroup) {
      this.createdGroup = this.engine.groupWidgets(this.overlayId, this.sceneId, this.widgetIds, this.groupName);
    }
    this.executed = true;
  }
}
