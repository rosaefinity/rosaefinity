// =============================================
// RosaeFinity — Workflow Builder Page
// Visual canvas editor with drag/drop, zoom,
// connections, context menu, undo/redo.
// =============================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageHeader } from '../components/ui/page-header';
import { EmptyState } from '../components/ui/empty-state';
import { Button } from '../components/ui/button';
import {
  getWorkflowEngine, getAllNodeDefinitions, getNodesByCategory,
  validateWorkflow, type Workflow, type WorkflowNode, type WorkflowConnection,
  type NodeType,
} from '../workflow';
import {
  Workflow as WorkflowIcon, Plus, Play, Pause, Square, Trash2,
  Copy, Download, Upload, Settings, CheckCircle2, XCircle,
  AlertTriangle, ZoomIn, ZoomOut, Maximize, Grid3x3,
  Search, ChevronDown, ChevronRight, Save, Undo2, Redo2,
} from 'lucide-react';

// ── Node Colors ──
const NODE_COLORS: Record<string, string> = {
  'Flow': 'border-blue-500/50 bg-blue-500/10',
  'Logic': 'border-yellow-500/50 bg-yellow-500/10',
  'Data': 'border-green-500/50 bg-green-500/10',
  'Actions': 'border-purple-500/50 bg-purple-500/10',
  'Integrations': 'border-cyan-500/50 bg-cyan-500/10',
  'Media': 'border-pink-500/50 bg-pink-500/10',
};

interface CanvasNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  selected: boolean;
  config: Record<string, unknown>;
}

interface CanvasConnection {
  id: string;
  fromNodeId: string;
  fromOutput: string;
  toNodeId: string;
  toInput: string;
}

export function WorkflowPage(): React.JSX.Element {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
  const [canvasConnections, setCanvasConnections] = useState<CanvasConnection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showNodePalette, setShowNodePalette] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Load workflows on mount
  useEffect(() => {
    const engine = getWorkflowEngine();
    engine.loadFromStorage('rf-workflows');
    setWorkflows(engine.getAllWorkflows());
  }, []);

  // ── Create new workflow ──
  const createWorkflow = useCallback(() => {
    const engine = getWorkflowEngine();
    const id = `wf-${Date.now().toString(36)}`;
    const workflow: Workflow = {
      id,
      name: 'New Workflow',
      description: '',
      enabled: true,
      trigger: { type: 'manual', config: {} },
      nodes: [
        { id: 'start-1', type: 'start', label: 'Start', config: {}, position: { x: 100, y: 200 } },
        { id: 'end-1', type: 'end', label: 'End', config: {}, position: { x: 500, y: 200 } },
      ],
      connections: [
        { id: 'conn-1', sourceNodeId: 'start-1', sourceOutput: 'out', targetNodeId: 'end-1', targetInput: 'in' },
      ],
      variables: [],
      metadata: { author: '', tags: [], executionCount: 0, avgExecutionTimeMs: 0, errorCount: 0 },
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    engine.register(workflow);
    engine.saveToStorage('rf-workflows');
    setWorkflows(engine.getAllWorkflows());
    loadWorkflowToCanvas(workflow);
  }, []);

  // ── Load workflow to canvas ──
  const loadWorkflowToCanvas = useCallback((workflow: Workflow) => {
    setActiveWorkflow(workflow);
    setCanvasNodes(workflow.nodes.map(n => ({
      id: n.id, type: n.type, label: n.label,
      x: n.position.x, y: n.position.y,
      selected: false, config: n.config,
    })));
    setCanvasConnections(workflow.connections.map(c => ({
      id: c.id, fromNodeId: c.sourceNodeId, fromOutput: c.sourceOutput,
      toNodeId: c.targetNodeId, toInput: c.targetInput,
    })));
    setSelectedNodeId(null);

    // Validate
    const errors = validateWorkflow(workflow);
    setValidationErrors(errors);
  }, []);

  // ── Add node to canvas ──
  const addNode = useCallback((type: NodeType) => {
    const def = getAllNodeDefinitions().find(d => d.type === type);
    if (!def) return;

    const newNode: CanvasNode = {
      id: `node-${Date.now().toString(36)}`,
      type,
      label: def.label,
      x: 200 + Math.random() * 200,
      y: 200 + Math.random() * 100,
      selected: false,
      config: { ...def.defaultConfig },
    };

    setCanvasNodes(prev => [...prev, newNode]);
  }, []);

  // ── Delete selected node ──
  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setCanvasNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    setCanvasConnections(prev => prev.filter(c => c.fromNodeId !== selectedNodeId && c.toNodeId !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId]);

  // ── Save workflow ──
  const saveWorkflow = useCallback(() => {
    if (!activeWorkflow) return;
    const engine = getWorkflowEngine();
    const updated: Workflow = {
      ...activeWorkflow,
      nodes: canvasNodes.map(n => ({
        id: n.id, type: n.type, label: n.label,
        config: n.config, position: { x: n.x, y: n.y },
      })),
      connections: canvasConnections.map(c => ({
        id: c.id, sourceNodeId: c.fromNodeId, sourceOutput: c.fromOutput,
        targetNodeId: c.toNodeId, targetInput: c.toInput,
      })),
      updatedAt: Date.now(),
    };
    engine.register(updated);
    engine.saveToStorage('rf-workflows');
    setWorkflows(engine.getAllWorkflows());
    setActiveWorkflow(updated);

    const errors = validateWorkflow(updated);
    setValidationErrors(errors);
  }, [activeWorkflow, canvasNodes, canvasConnections]);

  // ── Run workflow ──
  const runWorkflow = useCallback(async () => {
    if (!activeWorkflow) return;
    setIsRunning(true);
    const engine = getWorkflowEngine();
    await engine.execute(activeWorkflow.id);
    setIsRunning(false);
  }, [activeWorkflow]);

  // ── Node drag handler ──
  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedNodeId) return;
    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;
    setCanvasNodes(prev => prev.map(n =>
      n.id === selectedNodeId ? { ...n, x: n.x + dx, y: n.y + dy } : n
    ));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, selectedNodeId, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ── Filtered node definitions ──
  const filteredNodes = searchQuery
    ? getAllNodeDefinitions().filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const nodesByCategory = getNodesByCategory();

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f]">
      {/* Toolbar */}
      <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2 shrink-0">
        <WorkflowIcon className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-white">Workflow Builder</span>
        <span className="text-xs text-gray-500 mx-2">|</span>
        <span className="text-xs text-gray-400">{activeWorkflow?.name || 'No workflow'}</span>

        <div className="flex-1" />

        {/* Validation status */}
        {validationErrors.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-yellow-400">
            <AlertTriangle className="w-3 h-3" />
            {validationErrors.filter(e => e.type === 'error').length} errors
          </span>
        )}

        <Button size="sm" variant="ghost" onClick={saveWorkflow} className="text-gray-400 hover:text-white h-7">
          <Save className="w-3.5 h-3.5 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={deleteSelected} disabled={!selectedNodeId} className="text-gray-400 hover:text-red-400 h-7">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs text-gray-500">|</span>
        <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="text-gray-400 hover:text-white h-7">
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs text-gray-400 font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="ghost" onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="text-gray-400 hover:text-white h-7">
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="text-gray-400 hover:text-white h-7">
          <Maximize className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs text-gray-500">|</span>
        {!isRunning ? (
          <Button size="sm" onClick={runWorkflow} className="bg-green-600 hover:bg-green-500 text-white h-7">
            <Play className="w-3.5 h-3.5 mr-1" /> Run
          </Button>
        ) : (
          <Button size="sm" onClick={() => getWorkflowEngine().stopAll()} className="bg-red-600 hover:bg-red-500 text-white h-7">
            <Square className="w-3.5 h-3.5 mr-1" /> Stop
          </Button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Node Palette */}
        {showNodePalette && (
          <div className="w-56 border-r border-white/10 flex flex-col shrink-0">
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search nodes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-gray-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-3">
              {filteredNodes ? (
                filteredNodes.map(node => (
                  <button
                    key={node.type}
                    onClick={() => addNode(node.type)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
                  >
                    <span className="text-sm">{node.icon}</span>
                    <span className="text-xs text-gray-300">{node.label}</span>
                  </button>
                ))
              ) : (
                Array.from(nodesByCategory.entries()).map(([category, nodes]) => (
                  <div key={category}>
                    <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider px-2 mb-1">{category}</div>
                    <div className="space-y-1">
                      {nodes.map(node => (
                        <button
                          key={node.type}
                          onClick={() => addNode(node.type)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-lg text-left transition-colors"
                        >
                          <span className="text-sm">{node.icon}</span>
                          <span className="text-xs text-gray-400">{node.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Workflow list */}
            <div className="border-t border-white/10 p-2">
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider px-2 mb-1">Workflows</div>
              <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                {workflows.map(w => (
                  <button
                    key={w.id}
                    onClick={() => loadWorkflowToCanvas(w)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors ${
                      activeWorkflow?.id === w.id ? 'bg-purple-500/10 text-purple-400' : 'hover:bg-white/5 text-gray-400'
                    }`}
                  >
                    <span className="text-xs truncate">{w.name}</span>
                  </button>
                ))}
              </div>
              <Button size="sm" variant="outline" className="w-full mt-2 border-white/10 text-xs h-7" onClick={createWorkflow}>
                <Plus className="w-3 h-3 mr-1" /> New Workflow
              </Button>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-[#0d0d14]"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelectedNodeId(null)}
        >
          {/* Grid */}
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
          }} />

          {/* Nodes */}
          <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
            {/* Connection lines */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: '5000px', height: '5000px' }}>
              {canvasConnections.map(conn => {
                const fromNode = canvasNodes.find(n => n.id === conn.fromNodeId);
                const toNode = canvasNodes.find(n => n.id === conn.toNodeId);
                if (!fromNode || !toNode) return null;
                const x1 = fromNode.x + 80;
                const y1 = fromNode.y + 30;
                const x2 = toNode.x;
                const y2 = toNode.y + 30;
                const mx = (x1 + x2) / 2;
                return (
                  <path
                    key={conn.id}
                    d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                    stroke="rgba(168, 85, 247, 0.4)"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(168, 85, 247, 0.6)" />
                </marker>
              </defs>
            </svg>

            {/* Node cards */}
            {canvasNodes.map(node => {
              const def = getAllNodeDefinitions().find(d => d.type === node.type);
              const colorClass = NODE_COLORS[def?.category || 'Flow'] || NODE_COLORS['Flow'];
              const isSelected = selectedNodeId === node.id;

              return (
                <div
                  key={node.id}
                  className={`absolute cursor-move select-none rounded-xl border-2 shadow-lg transition-shadow ${
                    colorClass
                  } ${isSelected ? 'ring-2 ring-purple-500 shadow-purple-500/20' : 'hover:shadow-white/5'}`}
                  style={{ left: node.x, top: node.y, width: 160 }}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{def?.icon || '?'}</span>
                      <span className="text-xs font-medium text-white truncate">{node.label}</span>
                    </div>
                    {node.type !== 'start' && node.type !== 'end' && (
                      <div className="text-[10px] text-gray-500 mt-1 truncate">
                        {def?.description || node.type}
                      </div>
                    )}
                  </div>
                  {/* Ports */}
                  {def?.inputs.map((port, i) => (
                    <div key={port.id} className="absolute left-0 w-3 h-3 bg-white/20 border border-white/40 rounded-full -ml-1.5" style={{ top: 20 + i * 16 }} />
                  ))}
                  {def?.outputs.map((port, i) => (
                    <div key={port.id} className="absolute right-0 w-3 h-3 bg-purple-500/50 border border-purple-400 rounded-full -mr-1.5" style={{ top: 20 + i * 16 }} />
                  ))}
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {canvasNodes.length === 0 && !activeWorkflow && (
            <div className="absolute inset-0 flex items-center justify-center">
              <EmptyState
                icon={WorkflowIcon}
                title="No Workflows Yet"
                description="Create your first workflow to automate your stream"
                action={{ label: 'Create Workflow', onClick: createWorkflow }}
              />
            </div>
          )}
        </div>

        {/* Right Panel: Properties */}
        {showProperties && selectedNodeId && (
          <div className="w-64 border-l border-white/10 flex flex-col shrink-0">
            <div className="p-3 border-b border-white/10">
              <div className="text-xs font-medium text-white">Properties</div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
              {(() => {
                const node = canvasNodes.find(n => n.id === selectedNodeId);
                if (!node) return null;
                const def = getAllNodeDefinitions().find(d => d.type === node.type);
                return (
                  <>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase">Label</label>
                      <input
                        type="text"
                        value={node.label}
                        onChange={e => setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, label: e.target.value } : n))}
                        className="w-full mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase">Type</label>
                      <div className="mt-1 text-xs text-gray-400">{node.type}</div>
                    </div>
                    {node.type === 'delay' && (
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase">Duration (ms)</label>
                        <input
                          type="number"
                          value={node.config.durationMs as number || 1000}
                          onChange={e => setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, config: { ...n.config, durationMs: Number(e.target.value) } } : n))}
                          className="w-full mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
                        />
                      </div>
                    )}
                    {node.type === 'notification' && (
                      <>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase">Title</label>
                          <input
                            type="text"
                            value={node.config.title as string || ''}
                            onChange={e => setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, config: { ...n.config, title: e.target.value } } : n))}
                            className="w-full mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase">Message</label>
                          <input
                            type="text"
                            value={node.config.message as string || ''}
                            onChange={e => setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, config: { ...n.config, message: e.target.value } } : n))}
                            className="w-full mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>
                      </>
                    )}
                    {node.type === 'variable' && (
                      <>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase">Variable Name</label>
                          <input
                            type="text"
                            value={node.config.variable as string || ''}
                            onChange={e => setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, config: { ...n.config, variable: e.target.value } } : n))}
                            className="w-full mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 uppercase">Value</label>
                          <input
                            type="text"
                            value={node.config.value as string || ''}
                            onChange={e => setCanvasNodes(prev => prev.map(n => n.id === node.id ? { ...n, config: { ...n.config, value: e.target.value } } : n))}
                            className="w-full mt-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-6 border-t border-white/10 flex items-center px-4 text-[10px] text-gray-500 gap-4 shrink-0">
        <span>{canvasNodes.length} nodes</span>
        <span>{canvasConnections.length} connections</span>
        {isRunning && <span className="text-green-400">● Running</span>}
        {validationErrors.length > 0 && (
          <span className="text-yellow-400">{validationErrors.length} validation issues</span>
        )}
      </div>
    </div>
  );
}
export default WorkflowPage;
