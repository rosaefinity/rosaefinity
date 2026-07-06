import { describe, it, expect, beforeEach } from 'vitest';
import { OverlayEngine } from '../../engine/overlay/overlay-engine';
import { CommandManager } from '../../engine/commands/command-manager';
import { EditorStateManager } from '../../engine/editor/editor-state';
import { SelectionManager } from '../../engine/editor/selection-manager';
import { UpdateWidgetCommand } from '../../engine/commands/commands';
import type { Widget } from '../../types/overlay-types';

// ===== Helpers =====
let engine: OverlayEngine;
let commandManager: CommandManager;
let editorState: EditorStateManager;
let selection: SelectionManager;
let overlayId: string;
let sceneId: string;
let widget: Widget;

function getWidget(): Widget {
  return engine.getWidget(overlayId, sceneId, widget.id)!;
}

beforeEach(() => {
  engine = new OverlayEngine();
  commandManager = new CommandManager();
  editorState = new EditorStateManager();
  selection = new SelectionManager(editorState);

  const overlay = engine.createOverlay('Test');
  overlayId = overlay.id;
  const scene = engine.createScene(overlayId, 'Scene 1');
  sceneId = scene.id;
  widget = engine.createWidget(overlayId, sceneId, 'text');

  editorState.selectOverlay(overlayId);
  editorState.selectScene(sceneId);
  selection.selectWidget(widget.id);
});

describe('useInspector — command dispatch', () => {
  it('creates UpdateWidgetCommand on property change', () => {
    const cmd = new UpdateWidgetCommand(engine, overlayId, sceneId, widget.id, { visible: false });
    commandManager.execute(cmd);

    expect(getWidget().visible).toBe(false);
    expect(commandManager.canUndo()).toBe(true);
  });

  it('undo restores previous state', () => {
    const cmd = new UpdateWidgetCommand(engine, overlayId, sceneId, widget.id, { x: 500 });
    commandManager.execute(cmd);
    expect(getWidget().x).toBe(500);

    commandManager.undo();
    expect(getWidget().x).toBe(100);
  });

  it('redo re-applies change', () => {
    const cmd = new UpdateWidgetCommand(engine, overlayId, sceneId, widget.id, { rotation: 45 });
    commandManager.execute(cmd);
    commandManager.undo();
    commandManager.redo();

    expect(getWidget().rotation).toBe(45);
  });

  it('updates widget props correctly', () => {
    const cmd = new UpdateWidgetCommand(engine, overlayId, sceneId, widget.id, {
      props: { ...widget.props, text: 'Hello World', color: '#ff0000' },
    });
    commandManager.execute(cmd);

    const updated = getWidget();
    expect(updated.props.text).toBe('Hello World');
    expect(updated.props.color).toBe('#ff0000');
  });

  it('updates zIndex for layer commands', () => {
    const cmd = new UpdateWidgetCommand(engine, overlayId, sceneId, widget.id, { zIndex: 10 });
    commandManager.execute(cmd);

    expect(getWidget().zIndex).toBe(10);
    commandManager.undo();
    expect(getWidget().zIndex).toBe(1);
  });
});
