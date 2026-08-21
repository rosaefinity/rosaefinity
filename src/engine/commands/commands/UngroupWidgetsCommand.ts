import type { Command } from "../command";
import type { OverlayEngine } from "../../overlay/overlay-engine";

let counter = 0;

export class UngroupWidgetsCommand implements Command {
  readonly id: string;
  readonly type = "UngroupWidgets";
  readonly description: string;

  private engine: OverlayEngine;
  private overlayId: string;
  private sceneId: string;
  private groupId: string;
  private executed = false;
  private groupName = "";
  private groupWidgetIds: string[] = [];
  private recreatedGroupId: string | null = null;

  constructor(engine: OverlayEngine, overlayId: string, sceneId: string, groupId: string) {
    this.id = `cmd_${Date.now().toString(36)}_${++counter}`;
    this.engine = engine;
    this.overlayId = overlayId;
    this.sceneId = sceneId;
    this.groupId = groupId;
    this.description = `Ungroup widgets`;
  }

  execute(): void {
    if (this.executed) throw new Error("[UngroupWidgetsCommand] Already executed");
    const overlay = this.engine.getOverlay(this.overlayId);
    if (!overlay) throw new Error(`[UngroupWidgetsCommand] Overlay not found: "${this.overlayId}"`);
    const scene = overlay.scenes.find((s) => s.id === this.sceneId);
    if (!scene) throw new Error(`[UngroupWidgetsCommand] Scene not found: "${this.sceneId}"`);
    const group = scene.groups.find((g) => g.id === this.groupId);
    if (!group) throw new Error(`[UngroupWidgetsCommand] Group not found: "${this.groupId}"`);
    this.groupName = group.name;
    this.groupWidgetIds = [...group.widgetIds];
    this.engine.ungroupWidgets(this.overlayId, this.sceneId, this.groupId);
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) throw new Error("[UngroupWidgetsCommand] Not yet executed");
    if (this.groupWidgetIds.length > 0) {
      const recreated = this.engine.groupWidgets(this.overlayId, this.sceneId, this.groupWidgetIds, this.groupName);
      this.recreatedGroupId = recreated.id;
    }
    this.executed = false;
  }

  redo(): void {
    if (this.executed) throw new Error("[UngroupWidgetsCommand] Already executed");
    const idToDelete = this.recreatedGroupId || this.groupId;
    this.engine.ungroupWidgets(this.overlayId, this.sceneId, idToDelete);
    this.executed = true;
  }
}
