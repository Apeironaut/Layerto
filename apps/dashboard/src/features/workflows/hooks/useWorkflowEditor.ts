import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import type { EdgeChange, NodeChange, XYPosition } from '@xyflow/react';
import type { PublicModelItem, Workflow, WorkflowDefinition, WorkflowNodeType, WorkflowValidationError } from '@layerto/types';
import { errorCode, errorMessage } from '@layerto/api-client';
import { api } from '../../../lib/api';
import {
  defaultConditionConfig,
  defaultForEachConfig,
  defaultModelConfig,
  newDefinition,
  upgradeDefinition,
} from '../lib/definition';
import type { FlowEdge, FlowNode, Link, StepConfig } from '../lib/graph';
import { autoLayout, connectionProblem, edgeId, fromFlow, localIssues, nextNodeId, toFlow } from '../lib/graph';
import { createHistory, push, redo as redoH, replace, undo as undoH } from '../lib/history';
import type { History } from '../lib/history';
import { findTemplate } from '../lib/templates';

interface Graph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface AddStepOptions {
  slug?: string;
  position?: XYPosition;
  /** Connect from this step (and handle) to the new one. */
  from?: { nodeId: string; handle?: string | null };
}

export interface EditorIssues {
  byNode: Record<string, string[]>;
  byEdge: Record<string, string>;
  general: string[];
  count: number;
}

/** Strips view-only state so comparing two graphs only sees real changes. */
function signature(g: Graph, name: string, description: string): string {
  return JSON.stringify({ name, description, def: fromFlow(g.nodes, g.edges) });
}

/**
 * State and actions for the workflow editor: the graph with undo/redo, selection,
 * live validation (local + server), and saving.
 */
export function useWorkflowEditor(workflowId: string | undefined, models: PublicModelItem[] | undefined, templateId?: string) {
  const [history, setHistory] = useState<History<Graph> | null>(null);
  const [name, setNameState] = useState('Untitled workflow');
  const [description, setDescription] = useState('');
  const [id, setId] = useState<string | undefined>(workflowId);
  const [version, setVersion] = useState(0);
  const [baseline, setBaseline] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<WorkflowValidationError[]>([]);
  const [callsPerImage, setCallsPerImage] = useState<{ min: number; max: number } | null>(null);

  // ---------------------------------------------------------------- load
  useEffect(() => {
    let cancelled = false;
    const init = (wf: Workflow | null, def: WorkflowDefinition) => {
      const g = toFlow(def);
      const laidOut = wf || templateId ? g : { ...g, nodes: autoLayout(g.nodes, g.edges) };
      const n = wf?.name ?? findTemplate(templateId)?.name ?? 'Untitled workflow';
      const d = wf?.description ?? '';
      setHistory(createHistory(laidOut));
      setNameState(n);
      setDescription(d);
      setVersion(wf?.version ?? 0);
      setId(wf?.id);
      setBaseline(wf ? signature(laidOut, n, d) : '');
    };
    if (workflowId) {
      api
        .getWorkflow(workflowId)
        .then((wf) => !cancelled && init(wf, upgradeDefinition(wf.definition)))
        .catch((err) => !cancelled && setLoadError(errorMessage(err, "Couldn't open this workflow.")));
    } else if (models) {
      const template = findTemplate(templateId);
      init(null, template ? template.build(models) : newDefinition(models[0]?.slug));
    }
    return () => {
      cancelled = true;
    };
    // models only matters for a brand-new workflow; don't reload an open one when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId, models === undefined]);

  const graph = history?.present;
  const definition = useMemo(() => (graph ? fromFlow(graph.nodes, graph.edges) : null), [graph]);

  // ---------------------------------------------------------------- validation
  const available = useMemo(() => new Set((models ?? []).map((m) => m.slug)), [models]);
  const local = useMemo(
    () => (definition ? localIssues(definition, (slug) => !models || available.has(slug)) : { byNode: {}, general: [] }),
    [definition, models, available],
  );

  useEffect(() => {
    if (!definition) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .validateWorkflow(definition)
        .then((res) => {
          if (cancelled) return;
          setServerErrors(res.errors);
          setCallsPerImage(res.calls_per_image ?? null);
        })
        .catch(() => undefined);
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [definition]);

  const issues: EditorIssues = useMemo(() => {
    const byNode: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(local.byNode)) byNode[k] = [...v];
    const byEdge: Record<string, string> = {};
    const general = [...local.general];
    for (const e of serverErrors) {
      if (e.edge_id) byEdge[e.edge_id] = e.message;
      else if (e.node_id) {
        const list = (byNode[e.node_id] ??= []);
        if (!list.includes(e.message)) list.push(e.message);
      } else if (!general.includes(e.message)) general.push(e.message);
    }
    const count = Object.values(byNode).reduce((n, l) => n + l.length, 0) + Object.keys(byEdge).length + general.length;
    return { byNode, byEdge, general, count };
  }, [local, serverErrors]);

  /** Nodes and edges decorated with their issues, for drawing. */
  const view = useMemo(() => {
    if (!graph) return { nodes: [] as FlowNode[], edges: [] as FlowEdge[] };
    return {
      nodes: graph.nodes.map((n) => ({ ...n, data: { ...n.data, issues: issues.byNode[n.id] ?? [] } })),
      edges: graph.edges.map((e) => ({ ...e, data: { issue: issues.byEdge[e.id] } })),
    };
  }, [graph, issues]);

  // ---------------------------------------------------------------- edits
  const commit = useCallback((fn: (g: Graph) => Graph) => setHistory((h) => (h ? push(h, fn(h.present)) : h)), []);
  const silent = useCallback((fn: (g: Graph) => Graph) => setHistory((h) => (h ? replace(h, fn(h.present)) : h)), []);

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const safe = changes.filter((c) => !(c.type === 'remove' && (c.id === 'input' || c.id === 'output')));
      if (!safe.length) return;
      const meaningful = safe.some((c) => c.type === 'remove' || (c.type === 'position' && c.dragging === false));
      const apply = (g: Graph) => {
        const removed = new Set(safe.filter((c) => c.type === 'remove').map((c) => c.id));
        return {
          nodes: applyNodeChanges(safe, g.nodes),
          edges: removed.size ? g.edges.filter((e) => !removed.has(e.source) && !removed.has(e.target)) : g.edges,
        };
      };
      if (meaningful) commit(apply);
      else silent(apply);
    },
    [commit, silent],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      const apply = (g: Graph) => ({ ...g, edges: applyEdgeChanges(changes, g.edges) });
      if (changes.some((c) => c.type === 'remove')) commit(apply);
      else silent(apply);
    },
    [commit, silent],
  );

  /** Adds a connection; returns a reason when it isn't allowed. */
  const connect = useCallback(
    (link: Link): string | null => {
      if (!graph) return 'Not ready.';
      const problem = connectionProblem(graph.nodes, graph.edges, link);
      if (problem) return problem;
      commit((g) => ({
        ...g,
        edges: [...g.edges, { id: edgeId(link), source: link.source, target: link.target, sourceHandle: link.sourceHandle ?? null, type: 'step' }],
      }));
      return null;
    },
    [graph, commit],
  );

  /** Adds a step; models auto-connect to Output so their results show up. Returns the new id. */
  const addStep = useCallback(
    (type: WorkflowNodeType, opts: AddStepOptions = {}): string | null => {
      if (!graph || type === 'input' || type === 'output') return null;
      const newId = nextNodeId(type, graph.nodes);
      const from = opts.from ? graph.nodes.find((n) => n.id === opts.from!.nodeId) : undefined;
      const position = opts.position ?? (from ? { x: from.position.x + 340, y: from.position.y + (opts.from?.handle === 'no' ? 150 : 0) } : { x: 300, y: 320 });
      let config: StepConfig;
      if (type === 'model') config = defaultModelConfig(opts.slug ?? '');
      else if (type === 'condition') config = defaultConditionConfig();
      else config = defaultForEachConfig();
      const node: FlowNode = { id: newId, type, position, data: { config, issues: [] }, selected: true };

      commit((g) => {
        const edges = [...g.edges];
        if (from) {
          const link = { source: from.id, sourceHandle: opts.from!.handle ?? null, target: newId };
          if (!connectionProblem([...g.nodes, node], edges, link)) {
            edges.push({ id: edgeId(link), source: link.source, target: newId, sourceHandle: link.sourceHandle, type: 'step' });
          }
        }
        if (type === 'model') {
          const link = { source: newId, target: 'output' };
          edges.push({ id: edgeId(link), source: newId, target: 'output', type: 'step' });
        }
        return { nodes: [...g.nodes.map((n) => ({ ...n, selected: false })), node], edges };
      });
      return newId;
    },
    [graph, commit],
  );

  const updateConfig = useCallback(
    (nodeId: string, patch: Partial<StepConfig>) =>
      commit((g) => ({
        ...g,
        nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } as StepConfig } } : n)),
      })),
    [commit],
  );

  const removeNodes = useCallback(
    (ids: string[]) => {
      const set = new Set(ids.filter((i) => i !== 'input' && i !== 'output'));
      if (!set.size) return;
      commit((g) => ({ nodes: g.nodes.filter((n) => !set.has(n.id)), edges: g.edges.filter((e) => !set.has(e.source) && !set.has(e.target)) }));
    },
    [commit],
  );

  /** Removes selected steps (never Input/Output) and selected connections. */
  const removeSelected = useCallback(
    () =>
      commit((g) => {
        const gone = new Set(g.nodes.filter((n) => n.selected && n.type !== 'input' && n.type !== 'output').map((n) => n.id));
        return {
          nodes: g.nodes.filter((n) => !gone.has(n.id)),
          edges: g.edges.filter((e) => !e.selected && !gone.has(e.source) && !gone.has(e.target)),
        };
      }),
    [commit],
  );

  const removeEdge = useCallback((edgeIdToRemove: string) => commit((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== edgeIdToRemove) })), [commit]);

  const duplicate = useCallback(
    (nodeId: string): string | null => {
      if (!graph) return null;
      const src = graph.nodes.find((n) => n.id === nodeId);
      if (!src || src.type === 'input' || src.type === 'output') return null;
      const newId = nextNodeId(src.type!, graph.nodes);
      commit((g) => ({
        ...g,
        nodes: [
          ...g.nodes.map((n) => ({ ...n, selected: false })),
          { ...src, id: newId, selected: true, position: { x: src.position.x + 40, y: src.position.y + 90 }, data: { config: structuredClone(src.data.config), issues: [] } },
        ],
      }));
      return newId;
    },
    [graph, commit],
  );

  const select = useCallback(
    (nodeId: string | null) => silent((g) => ({ nodes: g.nodes.map((n) => ({ ...n, selected: n.id === nodeId })), edges: g.edges.map((e) => ({ ...e, selected: false })) })),
    [silent],
  );

  const tidy = useCallback(() => commit((g) => ({ ...g, nodes: autoLayout(g.nodes, g.edges) })), [commit]);
  const undo = useCallback(() => setHistory((h) => (h ? undoH(h) : h)), []);
  const redo = useCallback(() => setHistory((h) => (h ? redoH(h) : h)), []);

  // ---------------------------------------------------------------- save / delete
  const dirty = !!graph && (baseline === '' || signature(graph, name, description) !== baseline);

  const save = useCallback(async (): Promise<Workflow | null> => {
    if (!graph || !definition) return null;
    setSaving(true);
    setSaveError(null);
    try {
      const body = { name: name.trim() || 'Untitled workflow', description: description.trim(), definition };
      const saved = id ? await api.updateWorkflow(id, { ...body, version }) : await api.createWorkflow(body);
      setId(saved.id);
      setVersion(saved.version);
      setBaseline(signature(graph, body.name, body.description));
      return saved;
    } catch (err) {
      setSaveError(
        errorCode(err) === 'version_conflict'
          ? 'This workflow was changed somewhere else. Reload the page to see the latest version.'
          : errorMessage(err, "Couldn't save. Fix the highlighted problems and try again."),
      );
      return null;
    } finally {
      setSaving(false);
    }
  }, [graph, definition, id, name, description, version]);

  const deleteWorkflow = useCallback(async (): Promise<boolean> => {
    if (!id) return true;
    try {
      await api.deleteWorkflow(id);
      return true;
    } catch (err) {
      setSaveError(errorMessage(err, "Couldn't delete the workflow."));
      return false;
    }
  }, [id]);

  const selectedNode = view.nodes.find((n) => n.selected) ?? null;

  return {
    ready: !!graph,
    loadError,
    id,
    name,
    setName: setNameState,
    description,
    setDescription,
    nodes: view.nodes,
    edges: view.edges,
    definition,
    selectedNode,
    issues,
    callsPerImage,
    dirty,
    saving,
    saveError,
    clearSaveError: () => setSaveError(null),
    canUndo: !!history && history.past.length > 0,
    canRedo: !!history && history.future.length > 0,
    onNodesChange,
    onEdgesChange,
    connect,
    addStep,
    updateConfig,
    removeNodes,
    removeEdge,
    removeSelected,
    duplicate,
    select,
    tidy,
    undo,
    redo,
    save,
    deleteWorkflow,
  };
}

export type WorkflowEditor = ReturnType<typeof useWorkflowEditor>;
