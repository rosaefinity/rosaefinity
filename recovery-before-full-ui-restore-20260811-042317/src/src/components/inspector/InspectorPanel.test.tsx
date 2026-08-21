// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { OverlayEngine } from "../../engine/overlay/overlay-engine";
import { CommandManager } from "../../engine/commands/command-manager";
import { EditorStateManager } from "../../engine/editor/editor-state";
import { SelectionManager } from "../../engine/editor/selection-manager";
import { InspectorPanel } from "./InspectorPanel";
import type { EditorInstance, EditorSnapshot } from "../../hooks/use-editor";
import type { Widget } from "../../types/overlay-types";

// ===== Helpers =====
let engine: OverlayEngine;
let commandManager: CommandManager;
let editorState: EditorStateManager;
let selection: SelectionManager;

function makeInstance(): EditorInstance {
  engine = new OverlayEngine();
  commandManager = new CommandManager();
  editorState = new EditorStateManager();
  selection = new SelectionManager(editorState);

  return {
    engine,
    commandManager,
    editorState,
    selection,
    viewport: null as never,
    keyboard: null as never,
    interaction: null as never,
    alignment: null as never,
    persistence: null as never,
  };
}

function makeSnapshot(
  overlayId: string,
  sceneId: string,
  widgets: Widget[] = [],
): EditorSnapshot {
  const overlay = engine.getOverlay(overlayId);
  const scene = engine.getScene(overlayId, sceneId);
  return {
    overlays: overlay ? [overlay] : [],
    activeOverlay: overlay || null,
    activeScene: scene ? { ...scene, widgets } : null,
    editorState: {
      selectedOverlayId: overlayId,
      selectedSceneId: sceneId,
      selectedWidgetIds: widgets.map((w) => w.id),
      activeTool: "select",
      zoom: 1,
      panX: 0,
      panY: 0,
      gridVisible: true,
      snapToGrid: true,
      rulerVisible: false,
      clipboardWidgetIds: [],
    },
  };
}

// ===== Tests =====
describe("InspectorPanel", () => {
  let instance: EditorInstance;

  beforeEach(() => {
    instance = makeInstance();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows disabled state when no widget selected", () => {
    const overlay = instance.engine.createOverlay("Test");
    const scene = instance.engine.createScene(overlay.id, "Scene 1");
    const snapshot = makeSnapshot(overlay.id, scene.id, []);

    render(<InspectorPanel instance={instance} snapshot={snapshot} />);

    expect(
      screen.getByText(/Select a widget to edit/),
    ).toBeInTheDocument();
  });

  it("shows widget properties when single widget selected", () => {
    const overlay = instance.engine.createOverlay("Test");
    const scene = instance.engine.createScene(overlay.id, "Scene 1");
    const widget = instance.engine.createWidget(
      overlay.id,
      scene.id,
      "text",
    );
    const snapshot = makeSnapshot(overlay.id, scene.id, [widget]);

    render(<InspectorPanel instance={instance} snapshot={snapshot} />);

    expect(screen.getByText("Inspector")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Transform")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Layer")).toBeInTheDocument();
  });

  it("shows multi-select header when multiple widgets selected", () => {
    const overlay = instance.engine.createOverlay("Test");
    const scene = instance.engine.createScene(overlay.id, "Scene 1");
    const w1 = instance.engine.createWidget(
      overlay.id,
      scene.id,
      "text",
    );
    const w2 = instance.engine.createWidget(
      overlay.id,
      scene.id,
      "image",
    );
    const snapshot = makeSnapshot(overlay.id, scene.id, [w1, w2]);

    render(<InspectorPanel instance={instance} snapshot={snapshot} />);

    expect(
      screen.getByText("2 widgets selected"),
    ).toBeInTheDocument();
  });

  it("renders text-specific fields for text widget", () => {
    const overlay = instance.engine.createOverlay("Test");
    const scene = instance.engine.createScene(overlay.id, "Scene 1");
    const widget = instance.engine.createWidget(
      overlay.id,
      scene.id,
      "text",
    );
    const snapshot = makeSnapshot(overlay.id, scene.id, [widget]);

    render(<InspectorPanel instance={instance} snapshot={snapshot} />);

    expect(
      screen.getByText("Text Properties"),
    ).toBeInTheDocument();
    expect(screen.getByText("Font Family")).toBeInTheDocument();
    expect(screen.getByText("Font Size")).toBeInTheDocument();
  });

  it("renders image-specific fields for image widget", () => {
    const overlay = instance.engine.createOverlay("Test");
    const scene = instance.engine.createScene(overlay.id, "Scene 1");
    const widget = instance.engine.createWidget(
      overlay.id,
      scene.id,
      "image",
    );
    const snapshot = makeSnapshot(overlay.id, scene.id, [widget]);

    render(<InspectorPanel instance={instance} snapshot={snapshot} />);

    expect(
      screen.getByText("Image Properties"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Source URL"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fit Mode")).toBeInTheDocument();
  });

  it("executes UpdateWidgetCommand on property change", () => {
    const overlay = instance.engine.createOverlay("Test");
    const scene = instance.engine.createScene(overlay.id, "Scene 1");
    const widget = instance.engine.createWidget(
      overlay.id,
      scene.id,
      "text",
    );
    const snapshot = makeSnapshot(overlay.id, scene.id, [widget]);

    render(<InspectorPanel instance={instance} snapshot={snapshot} />);

    // Find the visible toggle (aria-checked="true" by default)
    const switches = screen.getAllByRole("switch");
    const visibleSwitch = switches.find(
      (s) => s.getAttribute("aria-checked") === "true",
    );
    expect(visibleSwitch).toBeTruthy();

    fireEvent.click(visibleSwitch!);

    // Command was executed
    expect(instance.commandManager.canUndo()).toBe(true);
    const updated = instance.engine.getWidget(
      overlay.id,
      scene.id,
      widget.id,
    );
    expect(updated!.visible).toBe(false);
  });

  it("undo restores previous state after inspector change", () => {
    const overlay = instance.engine.createOverlay("Test");
    const scene = instance.engine.createScene(overlay.id, "Scene 1");
    const widget = instance.engine.createWidget(
      overlay.id,
      scene.id,
      "text",
    );
    const snapshot = makeSnapshot(overlay.id, scene.id, [widget]);

    render(<InspectorPanel instance={instance} snapshot={snapshot} />);

    // Toggle visible off
    const switches = screen.getAllByRole("switch");
    const visibleSwitch = switches.find(
      (s) => s.getAttribute("aria-checked") === "true",
    );
    fireEvent.click(visibleSwitch!);

    // Undo
    instance.commandManager.undo();

    const restored = instance.engine.getWidget(
      overlay.id,
      scene.id,
      widget.id,
    );
    expect(restored!.visible).toBe(true);
  });
});
