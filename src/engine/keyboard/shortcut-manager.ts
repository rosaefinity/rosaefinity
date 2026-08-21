// =============================================
// Shortcut Manager — Registers, manages, and
// resolves keyboard shortcuts.
// =============================================

import type { ShortcutDefinition, ShortcutRegistration, KeyboardModifiers, KeyEvent } from "./shortcut-types";
import { keyboardEvents } from "./keyboard-events";

let shortcutCounter = 0;

export class ShortcutManager {
  private shortcuts: Map<string, ShortcutDefinition> = new Map();
  private enabled = true;
  private lastExecutedTimes: Map<string, number> = new Map();
  private debounceMs = 50;

  /**
   * Register a keyboard shortcut.
   * Returns the shortcut ID for later removal.
   */
  register(registration: ShortcutRegistration, action: (event: KeyEvent) => void): string {
    if (!registration.key || registration.key.length === 0) {
      throw new Error("[ShortcutManager] Key cannot be empty");
    }

    const id = `sc_${++shortcutCounter}`;
    const modifiers: KeyboardModifiers = {
      ctrl: registration.modifiers?.ctrl ?? false,
      shift: registration.modifiers?.shift ?? false,
      alt: registration.modifiers?.alt ?? false,
      meta: registration.modifiers?.meta ?? false,
    };

    this.shortcuts.set(id, {
      id,
      key: registration.key.toLowerCase(),
      modifiers,
      action,
      description: registration.description,
      enabled: true,
      priority: registration.priority ?? 0,
    });

    return id;
  }

  /**
   * Remove a shortcut by ID.
   */
  remove(id: string): boolean {
    return this.shortcuts.delete(id);
  }

  /**
   * Enable a shortcut by ID.
   */
  enable(id: string): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) shortcut.enabled = true;
  }

  /**
   * Disable a shortcut by ID.
   */
  disable(id: string): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) shortcut.enabled = false;
  }

  /**
   * Enable/disable all shortcuts.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if shortcuts are globally enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if a specific shortcut is enabled.
   */
  isShortcutEnabled(id: string): boolean {
    const shortcut = this.shortcuts.get(id);
    return shortcut?.enabled ?? false;
  }

  /**
   * Dispatch a key event to matching shortcuts.
   * Returns the ID of the executed shortcut, or null.
   */
  dispatch(event: KeyEvent, options?: { skipDebounce?: boolean }): string | null {
    if (!this.enabled) return null;

    // Find all matching shortcuts
    const matches: ShortcutDefinition[] = [];
    for (const shortcut of this.shortcuts.values()) {
      if (!shortcut.enabled) continue;
      if (this.matchesShortcut(shortcut, event)) {
        matches.push(shortcut);
      }
    }

    if (matches.length === 0) return null;

    // Sort by priority (highest first)
    matches.sort((a, b) => b.priority - a.priority);
    const best = matches[0];

    // Per-shortcut debounce: prevent duplicate execution of the SAME shortcut
    if (!options?.skipDebounce) {
      const now = event.timestamp;
      const lastTime = this.lastExecutedTimes.get(best.id) ?? 0;
      if (now - lastTime < this.debounceMs) {
        return null;
      }
    }

    // Execute
    best.action(event);
    this.lastExecutedTimes.set(best.id, event.timestamp);

    keyboardEvents.emit("shortcut:executed", {
      shortcutId: best.id,
      description: best.description,
      event,
    });

    return best.id;
  }

  /**
   * Check if a shortcut matches a key event.
   */
  private matchesShortcut(shortcut: ShortcutDefinition, event: KeyEvent): boolean {
    if (shortcut.key !== event.key.toLowerCase()) return false;
    if (shortcut.modifiers.ctrl !== event.modifiers.ctrl) return false;
    if (shortcut.modifiers.shift !== event.modifiers.shift) return false;
    if (shortcut.modifiers.alt !== event.modifiers.alt) return false;
    if (shortcut.modifiers.meta !== event.modifiers.meta) return false;
    return true;
  }

  /**
   * Get all registered shortcuts.
   */
  getAll(): ShortcutDefinition[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get a shortcut by ID.
   */
  get(id: string): ShortcutDefinition | undefined {
    return this.shortcuts.get(id);
  }

  /**
   * Check for shortcut conflicts (same key+modifiers).
   */
  findConflicts(key: string, modifiers: Partial<KeyboardModifiers>): string[] {
    const normalizedKey = key.toLowerCase();
    const mods: KeyboardModifiers = {
      ctrl: modifiers.ctrl ?? false,
      shift: modifiers.shift ?? false,
      alt: modifiers.alt ?? false,
      meta: modifiers.meta ?? false,
    };

    const conflicts: string[] = [];
    for (const shortcut of this.shortcuts.values()) {
      if (
        shortcut.key === normalizedKey &&
        shortcut.modifiers.ctrl === mods.ctrl &&
        shortcut.modifiers.shift === mods.shift &&
        shortcut.modifiers.alt === mods.alt &&
        shortcut.modifiers.meta === mods.meta
      ) {
        conflicts.push(shortcut.id);
      }
    }
    return conflicts;
  }

  /**
   * Remove all shortcuts.
   */
  clear(): void {
    this.shortcuts.clear();
  }

  /**
   * Get the number of registered shortcuts.
   */
  count(): number {
    return this.shortcuts.size;
  }
}
