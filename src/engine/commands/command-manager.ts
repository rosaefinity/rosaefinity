// =============================================
// Command Manager — Manages undo/redo history
// for all editor commands.
//
// The CommandManager owns the history stacks.
// OverlayEngine does not know about commands.
// =============================================

import type { Command } from "./command";

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    if (maxSize < 1) {
      throw new Error("[CommandManager] maxSize must be at least 1");
    }
    this.maxSize = maxSize;
  }

  /**
   * Execute a command and push it to the undo stack.
   * Clears the redo stack on new execution.
   * Discards oldest commands when stack exceeds maxSize.
   */
  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];

    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  /**
   * Undo the most recent command.
   * Moves it to the redo stack.
   */
  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
  }

  /**
   * Redo the most recently undone command.
   * Moves it back to the undo stack.
   */
  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.redo();
    this.undoStack.push(command);
  }

  /**
   * Clear both undo and redo stacks.
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get the number of undoable commands.
   */
  undoCount(): number {
    return this.undoStack.length;
  }

  /**
   * Get the number of redoable commands.
   */
  redoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Peek at the next command that would be undone (without executing).
   */
  peekUndo(): Command | undefined {
    return this.undoStack[this.undoStack.length - 1];
  }

  /**
   * Peek at the next command that would be redone (without executing).
   */
  peekRedo(): Command | undefined {
    return this.redoStack[this.redoStack.length - 1];
  }
}
