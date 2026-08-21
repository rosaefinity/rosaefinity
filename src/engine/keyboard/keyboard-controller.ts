// =============================================
// Keyboard Controller — Main orchestrator for
// keyboard shortcuts and clipboard operations.
//
// Routes key events to the correct handler.
// Registers all built-in shortcuts.
// =============================================

import type { OverlayEngine } from "../overlay/overlay-engine";
import type { CommandManager } from "../commands/command-manager";
import type { SelectionManager } from "../editor/selection-manager";
import type { KeyboardModifiers, KeyEvent } from "./shortcut-types";
import { ShortcutManager } from "./shortcut-manager";
import { ClipboardManager } from "./clipboard-manager";
import { keyboardEvents } from "./keyboard-events";
import { DeleteWidgetCommand } from "../commands/commands/DeleteWidgetCommand";
import { DuplicateWidgetCommand } from "../commands/commands/DuplicateWidgetCommand";
import { MoveWidgetCommand } from "../commands/commands/MoveWidgetCommand";
import { GroupWidgetsCommand } from "../commands/commands/GroupWidgetsCommand";
import { UngroupWidgetsCommand } from "../commands/commands/UngroupWidgetsCommand";

const MOVE_STEP = 1;
const MOVE_STEP_LARGE = 10;

export interface KeyboardControllerConfig {
  engine: OverlayEngine;
  commandManager: CommandManager;
  selectionManager: SelectionManager;
}

export class KeyboardController {
  private engine: OverlayEngine;
  private commandManager: CommandManager;
  private selection: SelectionManager;
  private shortcutManager: ShortcutManager;
  private clipboardManager: ClipboardManager;

  private modifiers: KeyboardModifiers = { ctrl: false, shift: false, alt: false, meta: false };
  private pressedKeys: Set<string> = new Set();
  private activeOverlayId: string | null = null;
  private activeSceneId: string | null = null;

  constructor(config: KeyboardControllerConfig) {
    this.engine = config.engine;
    this.commandManager = config.commandManager;
    this.selection = config.selectionManager;
    this.shortcutManager = new ShortcutManager();
    this.clipboardManager = new ClipboardManager(this.engine, this.commandManager, this.selection);

    this.registerBuiltInShortcuts();
  }

  /**
   * Set the active overlay/scene context for operations.
   */
  setActiveContext(overlayId: string | null, sceneId: string | null): void {
    this.activeOverlayId = overlayId;
    this.activeSceneId = sceneId;
  }

  /**
   * Get the shortcut manager for custom registrations.
   */
  getShortcutManager(): ShortcutManager {
    return this.shortcutManager;
  }

  /**
   * Get the clipboard manager.
   */
  getClipboardManager(): ClipboardManager {
    return this.clipboardManager;
  }

  /**
   * Handle key down event.
   */
  keyDown(key: string, code: string, modifiers?: Partial<KeyboardModifiers>): KeyEvent {
    const mods: KeyboardModifiers = {
      ctrl: modifiers?.ctrl ?? this.modifiers.ctrl,
      shift: modifiers?.shift ?? this.modifiers.shift,
      alt: modifiers?.alt ?? this.modifiers.alt,
      meta: modifiers?.meta ?? this.modifiers.meta,
    };

    // Track modifier state
    this.updateModifiers(key, true);
    mods.ctrl = this.modifiers.ctrl;
    mods.shift = this.modifiers.shift;
    mods.alt = this.modifiers.alt;
    mods.meta = this.modifiers.meta;

    const isRepeat = this.pressedKeys.has(key);
    this.pressedKeys.add(key);

    const event: KeyEvent = {
      key,
      code,
      modifiers: { ...mods },
      repeat: isRepeat,
      timestamp: Date.now(),
    };

    keyboardEvents.emit("keyboard:down", event);

    // Dispatch to shortcut manager (skip repeats unless it's a movement key)
    if (!isRepeat || this.isMovementKey(key)) {
      this.shortcutManager.dispatch(event, { skipDebounce: this.isMovementKey(key) && isRepeat });
    }

    return event;
  }

  /**
   * Handle key up event.
   */
  keyUp(key: string, code: string): KeyEvent {
    this.updateModifiers(key, false);
    this.pressedKeys.delete(key);

    const event: KeyEvent = {
      key,
      code,
      modifiers: { ...this.modifiers },
      repeat: false,
      timestamp: Date.now(),
    };

    keyboardEvents.emit("keyboard:up", event);
    return event;
  }

  /**
   * Get current modifier state.
   */
  getModifiers(): KeyboardModifiers {
    return { ...this.modifiers };
  }

  /**
   * Get the currently pressed keys.
   */
  getPressedKeys(): string[] {
    return Array.from(this.pressedKeys);
  }

  /**
   * Register a custom shortcut.
   */
  registerShortcut(
    key: string,
    modifiers: Partial<KeyboardModifiers>,
    action: (event: KeyEvent) => void,
    description: string,
    priority?: number,
  ): string {
    return this.shortcutManager.register({ key, modifiers, description, priority }, action);
  }

  // ─── Built-in Shortcuts ────────────────────────

  private registerBuiltInShortcuts(): void {
    const sm = this.shortcutManager;

    // Undo / Redo
    sm.register({ key: "z", modifiers: { ctrl: true }, description: "Undo", priority: 100 }, () => {
      this.commandManager.undo();
    });
    sm.register({ key: "y", modifiers: { ctrl: true }, description: "Redo", priority: 100 }, () => {
      this.commandManager.redo();
    });
    sm.register({ key: "z", modifiers: { ctrl: true, shift: true }, description: "Redo", priority: 101 }, () => {
      this.commandManager.redo();
    });

    // Copy / Cut / Paste / Duplicate
    sm.register({ key: "c", modifiers: { ctrl: true }, description: "Copy", priority: 90 }, () => {
      this.handleCopy();
    });
    sm.register({ key: "x", modifiers: { ctrl: true }, description: "Cut", priority: 90 }, () => {
      this.handleCut();
    });
    sm.register({ key: "v", modifiers: { ctrl: true }, description: "Paste", priority: 90 }, () => {
      this.handlePaste();
    });
    sm.register({ key: "d", modifiers: { ctrl: true }, description: "Duplicate", priority: 90 }, () => {
      this.handleDuplicate();
    });

    // Delete
    sm.register({ key: "delete", modifiers: {}, description: "Delete widgets", priority: 80 }, () => {
      this.handleDelete();
    });
    sm.register({ key: "backspace", modifiers: {}, description: "Delete widgets", priority: 80 }, () => {
      this.handleDelete();
    });

    // Select All
    sm.register({ key: "a", modifiers: { ctrl: true }, description: "Select all", priority: 85 }, () => {
      this.handleSelectAll();
    });

    // Escape
    sm.register({ key: "escape", modifiers: {}, description: "Clear selection", priority: 95 }, () => {
      this.selection.clearSelection();
    });

    // Group / Ungroup
    sm.register({ key: "g", modifiers: { ctrl: true }, description: "Group widgets", priority: 85 }, () => {
      this.handleGroup();
    });
    sm.register({ key: "g", modifiers: { ctrl: true, shift: true }, description: "Ungroup widgets", priority: 86 }, () => {
      this.handleUngroup();
    });

    // Arrow keys — move selected widgets
    sm.register({ key: "arrowleft", modifiers: {}, description: "Move left", priority: 70 }, (e) => {
      this.handleArrowMove(-MOVE_STEP, 0, e);
    });
    sm.register({ key: "arrowright", modifiers: {}, description: "Move right", priority: 70 }, (e) => {
      this.handleArrowMove(MOVE_STEP, 0, e);
    });
    sm.register({ key: "arrowup", modifiers: {}, description: "Move up", priority: 70 }, (e) => {
      this.handleArrowMove(0, -MOVE_STEP, e);
    });
    sm.register({ key: "arrowdown", modifiers: {}, description: "Move down", priority: 70 }, (e) => {
      this.handleArrowMove(0, MOVE_STEP, e);
    });

    // Shift + Arrow — move by 10px
    sm.register({ key: "arrowleft", modifiers: { shift: true }, description: "Move left 10px", priority: 71 }, (e) => {
      this.handleArrowMove(-MOVE_STEP_LARGE, 0, e);
    });
    sm.register({ key: "arrowright", modifiers: { shift: true }, description: "Move right 10px", priority: 71 }, (e) => {
      this.handleArrowMove(MOVE_STEP_LARGE, 0, e);
    });
    sm.register({ key: "arrowup", modifiers: { shift: true }, description: "Move up 10px", priority: 71 }, (e) => {
      this.handleArrowMove(0, -MOVE_STEP_LARGE, e);
    });
    sm.register({ key: "arrowdown", modifiers: { shift: true }, description: "Move down 10px", priority: 71 }, (e) => {
      this.handleArrowMove(0, MOVE_STEP_LARGE, e);
    });
  }

  // ─── Handlers ──────────────────────────────────

  private handleCopy(): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;
    const count = this.clipboardManager.copy(this.activeOverlayId, this.activeSceneId);
    if (count === 0) {
      keyboardEvents.emit("shortcut:blocked", { shortcutId: "copy", reason: "No widgets selected" });
    }
  }

  private handleCut(): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;
    const count = this.clipboardManager.cut(this.activeOverlayId, this.activeSceneId);
    if (count === 0) {
      keyboardEvents.emit("shortcut:blocked", { shortcutId: "cut", reason: "No widgets selected" });
    }
  }

  private handlePaste(): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;
    const ids = this.clipboardManager.paste(this.activeOverlayId, this.activeSceneId);
    if (ids.length === 0) {
      keyboardEvents.emit("shortcut:blocked", { shortcutId: "paste", reason: "Clipboard is empty" });
    }
  }

  private handleDuplicate(): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;
    const selectedIds = this.selection.getSelectedWidgetIds();
    for (const id of selectedIds) {
      try {
        this.commandManager.execute(
          new DuplicateWidgetCommand(this.engine, this.activeOverlayId, this.activeSceneId, id),
        );
      } catch {
        // Widget may not exist
      }
    }
  }

  private handleDelete(): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;
    const selectedIds = this.selection.getSelectedWidgetIds();
    for (const id of selectedIds) {
      try {
        this.commandManager.execute(
          new DeleteWidgetCommand(this.engine, this.activeOverlayId, this.activeSceneId, id),
        );
      } catch {
        // Widget may not exist
      }
    }
    this.selection.clearSelection();
  }

  private handleSelectAll(): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;
    const scene = this.engine.getScene(this.activeOverlayId, this.activeSceneId);
    if (!scene) return;
    const allIds = scene.widgets.map((w) => w.id);
    this.selection.selectAll(allIds);
  }

  private handleGroup(): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;
    const selectedIds = this.selection.getSelectedWidgetIds();
    if (selectedIds.length < 2) return;
    try {
      this.commandManager.execute(
        new GroupWidgetsCommand(this.engine, this.activeOverlayId, this.activeSceneId, selectedIds, "Group"),
      );
    } catch {
      // Grouping may fail if widgets are already grouped
    }
  }

  private handleUngroup(): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;
    const scene = this.engine.getScene(this.activeOverlayId, this.activeSceneId);
    if (!scene) return;

    // Find groups that contain selected widgets
    const selectedIds = new Set(this.selection.getSelectedWidgetIds());
    const groupsToUngroup = new Set<string>();
    for (const group of scene.groups) {
      if (group.widgetIds.some((id) => selectedIds.has(id))) {
        groupsToUngroup.add(group.id);
      }
    }

    for (const groupId of groupsToUngroup) {
      try {
        this.commandManager.execute(
          new UngroupWidgetsCommand(this.engine, this.activeOverlayId, this.activeSceneId, groupId),
        );
      } catch {
        // Group may not exist
      }
    }
  }

  private handleArrowMove(dx: number, dy: number, event: KeyEvent): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;
    const selectedIds = this.selection.getSelectedWidgetIds();
    for (const id of selectedIds) {
      const widget = this.engine.getWidget(this.activeOverlayId, this.activeSceneId, id);
      if (!widget) continue;
      try {
        this.commandManager.execute(
          new MoveWidgetCommand(this.engine, this.activeOverlayId, this.activeSceneId, id, widget.x + dx, widget.y + dy),
        );
      } catch {
        // Widget may not exist
      }
    }
  }

  private updateModifiers(key: string, pressed: boolean): void {
    const k = key.toLowerCase();
    if (k === "control" || k === "ctrl") this.modifiers.ctrl = pressed;
    else if (k === "shift") this.modifiers.shift = pressed;
    else if (k === "alt") this.modifiers.alt = pressed;
    else if (k === "meta" || k === "os") this.modifiers.meta = pressed;
  }

  private isMovementKey(key: string): boolean {
    return ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key.toLowerCase());
  }
}
