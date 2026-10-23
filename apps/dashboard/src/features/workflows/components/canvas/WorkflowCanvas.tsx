import { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Ref } from 'react';
import { Background, BackgroundVariant, MiniMap, Panel, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import type { Connection, FinalConnectionState, IsValidConnection, XYPosition } from '@xyflow/react';
import type { PublicModelItem, WorkflowNodeType } from '@layerto/types';
import { Icon } from '@layerto/ui';
import type { FlowEdge, FlowNode } from '../../lib/graph';
import { ALLOWED_TARGETS, connectionProblem } from '../../lib/graph';
import type { WorkflowEditor } from '../../hooks/useWorkflowEditor';
import { useDocumentTheme } from '../../hooks/useDocumentTheme';
import { EditorContext } from './EditorContext';
import type { AddMenuRequest, EditorActions } from './EditorContext';
import { NODE_TYPES } from './nodes/StepNodes';
import { EDGE_TYPES } from './edges/StepEdge';
import { AddStepMenu } from './AddStepMenu';
import type { StepPick } from './AddStepMenu';
import { CanvasToolbar } from './CanvasToolbar';
import { NodeContextMenu } from './NodeContextMenu';
import type { MenuItem } from './NodeContextMenu';
import { DRAG_MIME } from './StepPalette';

export interface CanvasHandle {
  /** Opens the add-step menu after the selected step (or free-standing). */
  openAddMenu: () => void;
  fitView: () => void;
  closeMenus: () => void;
}

export interface WorkflowCanvasProps {
  editor: WorkflowEditor;
  models: PublicModelItem[] | undefined;
  favorites: string[];
  recent: string[];
  onToggleFavorite: (slug: string) => void;
  onModelUsed: (slug: string) => void;
  onProblem: (message: string) => void;
  onShowHelp: () => void;
  running: boolean;
  handle?: Ref<CanvasHandle>;
}

interface MenuState {
  x: number;
  y: number;
  flow: XYPosition;
  from?: { nodeId: string; handle?: string | null };
  allowed: WorkflowNodeType[];
}

const MENU_W = 320;
const MENU_H = 420;
const FREE_STEPS: WorkflowNodeType[] = ['model', 'condition', 'for_each'];

function Inner({ editor, models, favorites, recent, onToggleFavorite, onModelUsed, onProblem, onShowHelp, running, handle }: WorkflowCanvasProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const rf = useReactFlow<FlowNode, FlowEdge>();
  const theme = useDocumentTheme();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  /** Converts a screen point into a point inside the canvas, keeping a popup on screen. */
  const local = useCallback((clientX: number, clientY: number, w = MENU_W, h = MENU_H) => {
    const r = wrapper.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: Math.max(8, Math.min(clientX - r.left, r.width - w - 8)), y: Math.max(8, Math.min(clientY - r.top, r.height - h - 8)) };
  }, []);

  const openMenu = useCallback(
    (req: Partial<AddMenuRequest>) => {
      setCtx(null);
      const r = wrapper.current?.getBoundingClientRect();
      if (!r) return;
      const fromNode = req.from ? editor.nodes.find((n) => n.id === req.from!.nodeId) : undefined;
      let clientX = req.clientX;
      let clientY = req.clientY;
      if (clientX === undefined || clientY === undefined) {
        if (fromNode) {
          const p = rf.flowToScreenPosition({ x: fromNode.position.x + 280, y: fromNode.position.y });
          clientX = p.x;
          clientY = p.y;
        } else {
          clientX = r.left + r.width / 2 - MENU_W / 2;
          clientY = r.top + r.height / 3;
        }
      }
      const allowed = fromNode ? ALLOWED_TARGETS[fromNode.type as WorkflowNodeType] : FREE_STEPS;
      if (!allowed.length) {
        onProblem('Output is the last step; nothing can follow it.');
        return;
      }
      setMenu({ ...local(clientX, clientY), flow: rf.screenToFlowPosition({ x: clientX, y: clientY }), from: req.from, allowed });
    },
    [editor.nodes, rf, local, onProblem],
  );

  const openForSelection = useCallback(() => {
    const sel = editor.selectedNode;
    if (sel && ALLOWED_TARGETS[sel.type as WorkflowNodeType].length) {
      openMenu({ from: { nodeId: sel.id, handle: sel.type === 'condition' ? 'yes' : null } });
    } else {
      openMenu({});
    }
  }, [editor.selectedNode, openMenu]);

  useImperativeHandle(handle, () => ({
    openAddMenu: openForSelection,
    fitView: () => void rf.fitView({ padding: 0.2, duration: 300 }),
    closeMenus: () => {
      setMenu(null);
      setCtx(null);
    },
  }));

  const pick = useCallback(
    (p: StepPick) => {
      if (!menu) return;
      if (p.type === 'output' && menu.from) {
        const problem = editor.connect({ source: menu.from.nodeId, sourceHandle: menu.from.handle, target: 'output' });
        if (problem) onProblem(problem);
      } else {
        editor.addStep(p.type, { slug: p.slug, position: { x: menu.flow.x, y: menu.flow.y - 40 }, from: menu.from });
        if (p.slug) onModelUsed(p.slug);
      }
      setMenu(null);
    },
    [menu, editor, onModelUsed, onProblem],
  );

  const actions: EditorActions = useMemo(
    () => ({
      openAddMenu: (req) => openMenu(req),
      removeEdge: editor.removeEdge,
      modelBySlug: new Map((models ?? []).map((m) => [m.slug, m])),
      running,
    }),
    [openMenu, editor.removeEdge, models, running],
  );

  const isValidConnection: IsValidConnection<FlowEdge> = useCallback(
    (c) => connectionProblem(editor.nodes, editor.edges, { source: c.source, sourceHandle: c.sourceHandle, target: c.target }) === null,
    [editor.nodes, editor.edges],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const problem = editor.connect({ source: c.source, sourceHandle: c.sourceHandle, target: c.target });
      if (problem) onProblem(problem);
    },
    [editor, onProblem],
  );

  /** Releasing a dragged connection on empty canvas opens the menu right there. */
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      if (state.isValid || !state.fromNode || state.fromHandle?.type !== 'source' || state.toNode) return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      openMenu({ from: { nodeId: state.fromNode.id, handle: state.fromHandle.id ?? null }, clientX: point.clientX, clientY: point.clientY });
    },
    [openMenu],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const raw = e.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;
      e.preventDefault();
      try {
        const data = JSON.parse(raw) as { type: WorkflowNodeType; slug?: string };
        const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        editor.addStep(data.type, { slug: data.slug, position: { x: pos.x - 124, y: pos.y - 40 } });
        if (data.slug) onModelUsed(data.slug);
      } catch {
        // ignore unrelated drops
      }
    },
    [rf, editor, onModelUsed],
  );

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: FlowNode) => {
      e.preventDefault();
      setMenu(null);
      const fixed = node.type === 'input' || node.type === 'output';
      const items: MenuItem[] = [];
      if (ALLOWED_TARGETS[node.type as WorkflowNodeType].length) {
        items.push({ label: 'Add next step', icon: 'plus', shortcut: 'A', onSelect: () => openMenu({ from: { nodeId: node.id, handle: node.type === 'condition' ? 'yes' : null } }) });
      }
      if (node.type === 'condition') items.push({ label: 'Add step on “No”', icon: 'branch', onSelect: () => openMenu({ from: { nodeId: node.id, handle: 'no' } }) });
      if (node.type === 'model') {
        const slug = (node.data.config as { model_slug: string }).model_slug;
        if (slug) items.push({ label: favorites.includes(slug) ? 'Remove from favourites' : 'Add model to favourites', icon: 'star', onSelect: () => onToggleFavorite(slug) });
      }
      if (!fixed) {
        items.push({ label: 'Duplicate', icon: 'duplicate', shortcut: 'Ctrl+D', onSelect: () => editor.duplicate(node.id) });
        items.push({ label: 'Delete', icon: 'trash', shortcut: 'Del', danger: true, onSelect: () => editor.removeNodes([node.id]) });
      }
      if (items.length) setCtx({ ...local(e.clientX, e.clientY, 220, 44 * items.length), items });
    },
    [openMenu, editor, favorites, onToggleFavorite, local],
  );

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      setMenu(null);
      const { clientX, clientY } = e;
      setCtx({
        ...local(clientX, clientY, 220, 140),
        items: [
          { label: 'Add step here', icon: 'plus', onSelect: () => openMenu({ clientX, clientY }) },
          { label: 'Tidy layout', icon: 'wand', shortcut: 'Shift+L', onSelect: editor.tidy },
          { label: 'Fit to screen', icon: 'maximize', shortcut: 'F', onSelect: () => void rf.fitView({ padding: 0.2, duration: 300 }) },
        ],
      });
    },
    [local, openMenu, editor.tidy, rf],
  );

  const onlyEnds = editor.nodes.length <= 2;

  return (
    <EditorContext.Provider value={actions}>
      <div ref={wrapper} className="relative flex-1 min-w-0 bg-page" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <ReactFlow<FlowNode, FlowEdge>
          nodes={editor.nodes}
          edges={editor.edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          defaultEdgeOptions={{ type: 'step' }}
          onNodesChange={editor.onNodesChange}
          onEdgesChange={editor.onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          isValidConnection={isValidConnection}
          onNodeContextMenu={onNodeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={() => {
            setMenu(null);
            setCtx(null);
          }}
          deleteKeyCode={null}
          snapToGrid
          snapGrid={[20, 20]}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          minZoom={0.25}
          maxZoom={2}
          connectionRadius={36}
          colorMode={theme}
          proOptions={{ hideAttribution: false }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} color="var(--color-line-strong)" />
          <MiniMap pannable zoomable position="bottom-right" nodeBorderRadius={8} nodeColor={(n) => (n.type === 'model' ? '#A3122A' : n.type === 'condition' ? '#f59e0b' : n.type === 'for_each' ? '#059669' : '#5B5F6B')} maskColor="color-mix(in oklab, var(--color-page) 70%, transparent)" />
          <Panel position="bottom-center">
            <CanvasToolbar
              canUndo={editor.canUndo}
              canRedo={editor.canRedo}
              onUndo={editor.undo}
              onRedo={editor.redo}
              onTidy={editor.tidy}
              onFit={() => void rf.fitView({ padding: 0.2, duration: 300 })}
              onAdd={openForSelection}
              onHelp={onShowHelp}
            />
          </Panel>
        </ReactFlow>

        {onlyEnds && (
          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
            <div className="flex items-center gap-2 rounded-pill border border-line bg-card/95 px-4 py-2 text-sm text-ink-secondary shadow-l1">
              <Icon name="info" size={16} className="text-crimson" />
              Drag from the dot on <strong className="text-ink">Input</strong>, or press <kbd className="font-semibold">A</kbd>, to add your first model.
            </div>
          </div>
        )}

        {menu && (
          <AddStepMenu
            x={menu.x}
            y={menu.y}
            allowed={menu.allowed}
            models={models ?? []}
            favorites={favorites}
            recent={recent}
            onToggleFavorite={onToggleFavorite}
            onPick={pick}
            onClose={() => setMenu(null)}
          />
        )}
        {ctx && <NodeContextMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}
      </div>
    </EditorContext.Provider>
  );
}

/** The workflow canvas (with its own React Flow provider). */
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  );
}
