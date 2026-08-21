// =============================================
// useEditor Hook — Initializes and connects
// all editor engine instances.
//
// Manages lifecycle: init on mount, destroy on unmount.
// Returns stable references for the CanvasPage.
// =============================================

import { useRef, useEffect, useCallback, useState } from "react";
import { OverlayEngine } from "../engine/overlay/overlay-engine";
import { CommandManager } from "../engine/commands/command-manager";
import { EditorStateManager } from "../engine/editor/editor-state";
import { SelectionManager } from "../engine/editor/selection-manager";
import { ViewportManager } from "../engine/editor/viewport-manager";
import { KeyboardController } from "../engine/keyboard/keyboard-controller";
import { InteractionController } from "../engine/interactions/interaction-controller";
import { AlignmentController } from "../engine/alignment/alignment-controller";
import { DexieOverlayRepository } from "../engine/persistence/dexie-overlay-repository";
import { OverlayPersistence } from "../engine/persistence/overlay-persistence";
import { overlayEvents } from "../engine/overlay/overlay-events";
import { editorEvents } from "../engine/editor/editor-events";
import type { Overlay, Scene } from "../types/overlay-types";
import type { EditorState } from "../engine/editor/editor-state";

export interface EditorInstance {
  engine: OverlayEngine;
  commandManager: CommandManager;
  editorState: EditorStateManager;
  selection: SelectionManager;
  viewport: ViewportManager;
  keyboard: KeyboardController;
  interaction: InteractionController;
  alignment: AlignmentController;
  persistence: OverlayPersistence;
}

export interface EditorSnapshot {
  overlays: Overlay[];
  activeOverlay: Overlay | null;
  activeScene: Scene | null;
  editorState: EditorState;
}

export function useEditor() {
  const instanceRef = useRef<EditorInstance | null>(null);
  const [snapshot, setSnapshot] = useState<EditorSnapshot>({
    overlays: [],
    activeOverlay: null,
    activeScene: null,
    editorState: {
      selectedOverlayId: null,
      selectedSceneId: null,
      selectedWidgetIds: [],
      activeTool: "select",
      zoom: 1.0,
      panX: 0,
      panY: 0,
      gridVisible: true,
      snapToGrid: true,
      rulerVisible: false,
      clipboardWidgetIds: [],
    },
  });

  // Initialize engines on mount
  useEffect(() => {
    if (instanceRef.current) return;

    const engine = new OverlayEngine();
    const commandManager = new CommandManager();
    const editorState = new EditorStateManager();
    const selection = new SelectionManager(editorState);
    const viewport = new ViewportManager(editorState);
    const keyboard = new KeyboardController({ engine, commandManager, selectionManager: selection });
    const interaction = new InteractionController({ engine, commandManager, selectionManager: selection, viewportManager: viewport });
    const alignment = new AlignmentController({ engine, commandManager, selectionManager: selection });
    const repository = new DexieOverlayRepository();
    const persistence = new OverlayPersistence(repository);

    instanceRef.current = {
      engine, commandManager, editorState, selection, viewport,
      keyboard, interaction, alignment, persistence,
    };

    // Start persistence event listeners
    persistence.init();

    // Load overlays from persistence
    (async () => {
      try {
        const overlays = await persistence.list();
        for (const overlay of overlays) {
          engine.loadOverlay(overlay);
        }
        refreshSnapshot();
      } catch (err) {
        console.error("[useEditor] Failed to load overlays:", err);
      }
    })();

    // Subscribe to overlay events for auto-save and snapshot refresh
    const unsubOverlay = overlayEvents.on("overlay:created", () => refreshSnapshot());
    const unsubScene = overlayEvents.on("scene:created", () => refreshSnapshot());
    const unsubWidget = overlayEvents.on("widget:created", () => refreshSnapshot());
    const unsubDeleted = overlayEvents.on("overlay:deleted", () => refreshSnapshot());

    return () => {
      unsubOverlay();
      unsubScene();
      unsubWidget();
      unsubDeleted();
      persistence.destroy();
      instanceRef.current = null;
    };
  }, []);

  // Refresh the renderable snapshot from engine state
  const refreshSnapshot = useCallback(() => {
    const inst = instanceRef.current;
    if (!inst) return;

    const es = inst.editorState.getState();
    const overlays = inst.engine.listOverlays();
    const activeOverlay = es.selectedOverlayId ? inst.engine.getOverlay(es.selectedOverlayId) : null;
    const activeScene = es.selectedOverlayId && es.selectedSceneId
      ? inst.engine.getScene(es.selectedOverlayId, es.selectedSceneId)
      : null;

    setSnapshot({
      overlays,
      activeOverlay,
      activeScene,
      editorState: es,
    });
  }, []);

  // Subscribe to selection, viewport, and tool changes
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst) return;

    const unsubs = [
      // Re-snapshot on any selection change
      editorEvents.on("selection:changed", () => refreshSnapshot()),
      editorEvents.on("viewport:changed", () => refreshSnapshot()),
      editorEvents.on("tool:changed", () => refreshSnapshot()),
      editorEvents.on("clipboard:changed", () => refreshSnapshot()),
      editorEvents.on("preferences:changed", () => refreshSnapshot()),
    ];

    return () => unsubs.forEach((u) => u());
  }, [refreshSnapshot]);

  return { instance: instanceRef.current, snapshot, refreshSnapshot };
}
