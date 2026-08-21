import type { Command } from "../command";
import type { OverlayEngine } from "../../overlay/overlay-engine";
import type { Widget } from "../../types/overlay-types";

let counter = 0;

export class UpdateWidgetCommand implements Command {
  readonly id: string;
  readonly type = "UpdateWidget";
  readonly description: string;

  private engine: OverlayEngine;
  private overlayId: string;
  private sceneId: string;
  private widgetId: string;
  private changes: Partial<Omit<Widget, "id">>;
  private executed = false;
  private previousState: Partial<Widget> | null = null;

  constructor(engine: OverlayEngine, overlayId: string, sceneId: string, widgetId: string, changes: Partial<Omit<Widget, "id">>) {
    this.id = `cmd_${Date.now().toString(36)}_${++counter}`;
    this.engine = engine;
    this.overlayId = overlayId;
    this.sceneId = sceneId;
    this.widgetId = widgetId;
    this.changes = changes;
    this.description = `Update widget`;
  }

  execute(): void {
    if (this.executed) throw new Error("[UpdateWidgetCommand] Already executed");
    const widget = this.engine.getWidget(this.overlayId, this.sceneId, this.widgetId);
    if (!widget) throw new Error(`[UpdateWidgetCommand] Widget not found: "${this.widgetId}"`);

    // Capture only the fields that will change
    const prev: Partial<Widget> = {};
    for (const key of Object.keys(this.changes) as (keyof Widget)[]) {
      if (key in widget) {
        (prev as Record<string, unknown>)[key] = (widget as Record<string, unknown>)[key];
      }
    }
    this.previousState = prev;

    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, this.changes);
    this.executed = true;
  }

  undo(): void {
    if (!this.executed) throw new Error("[UpdateWidgetCommand] Not yet executed");
    if (this.previousState) {
      this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, this.previousState);
    }
    this.executed = false;
  }

  redo(): void {
    if (this.executed) throw new Error("[UpdateWidgetCommand] Already executed");
    this.engine.updateWidget(this.overlayId, this.sceneId, this.widgetId, this.changes);
    this.executed = true;
  }
}
