// =============================================
// Selection Manager — Manages widget selection
// within the editor.
//
// Delegates state storage to EditorStateManager.
// Provides higher-level selection operations.
// =============================================

import type { EditorStateManager } from "./editor-state";

function validateWidgetId(id: string): void {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    throw new Error("[SelectionManager] Widget ID cannot be empty");
  }
}

function deduplicate(ids: string[]): string[] {
  return [...new Set(ids)];
}

export class SelectionManager {
  private editorState: EditorStateManager;

  constructor(editorState: EditorStateManager) {
    this.editorState = editorState;
  }

  /**
   * Select a single widget. Replaces current selection.
   */
  selectWidget(widgetId: string): void {
    validateWidgetId(widgetId);
    this.editorState.setSelectedWidgets([widgetId]);
  }

  /**
   * Select multiple widgets. Replaces current selection.
   * Deduplicates IDs automatically.
   */
  selectWidgets(widgetIds: string[]): void {
    if (widgetIds.length === 0) {
      this.editorState.setSelectedWidgets([]);
      return;
    }
    const deduped = deduplicate(widgetIds);
    validateAllWidgetIds(deduped);
    this.editorState.setSelectedWidgets(deduped);
  }

  /**
   * Toggle a widget in/out of the current selection.
   */
  toggleSelection(widgetId: string): void {
    validateWidgetId(widgetId);
    const current = this.editorState.getState().selectedWidgetIds;
    const index = current.indexOf(widgetId);

    if (index >= 0) {
      // Remove from selection
      this.editorState.setSelectedWidgets(current.filter((id) => id !== widgetId));
    } else {
      // Add to selection
      this.editorState.setSelectedWidgets([...current, widgetId]);
    }
  }

  /**
   * Clear all widget selections.
   */
  clearSelection(): void {
    this.editorState.setSelectedWidgets([]);
  }

  /**
   * Select all provided widget IDs.
   * If called without arguments, selects nothing (use with known widget list).
   */
  selectAll(allWidgetIds: string[]): void {
    if (allWidgetIds.length === 0) {
      this.editorState.setSelectedWidgets([]);
      return;
    }
    const deduped = deduplicate(allWidgetIds);
    validateAllWidgetIds(deduped);
    this.editorState.setSelectedWidgets(deduped);
  }

  /**
   * Invert the selection given the full list of available widget IDs.
   * Widgets that were selected become unselected, and vice versa.
   */
  invertSelection(allWidgetIds: string[]): void {
    if (allWidgetIds.length === 0) {
      this.editorState.setSelectedWidgets([]);
      return;
    }
    validateAllWidgetIds(allWidgetIds);

    const current = new Set(this.editorState.getState().selectedWidgetIds);
    const inverted = allWidgetIds.filter((id) => !current.has(id));
    this.editorState.setSelectedWidgets(deduplicate(inverted));
  }

  /**
   * Get the current selected widget IDs.
   */
  getSelectedWidgetIds(): string[] {
    return [...this.editorState.getState().selectedWidgetIds];
  }

  /**
   * Get the count of selected widgets.
   */
  getSelectionCount(): number {
    return this.editorState.getState().selectedWidgetIds.length;
  }

  /**
   * Check if a specific widget is selected.
   */
  isSelected(widgetId: string): boolean {
    return this.editorState.getState().selectedWidgetIds.includes(widgetId);
  }
}

function validateAllWidgetIds(ids: string[]): void {
  for (const id of ids) {
    validateWidgetId(id);
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`[SelectionManager] Duplicate widget ID: "${id}"`);
    }
    seen.add(id);
  }
}
