import type { Edge, Node } from '@xyflow/react';
import type {
  OutputConfig,
  WorkflowConditionConfig,
  WorkflowDefinition,
  WorkflowForEachConfig,
  WorkflowInputConfig,
  WorkflowModelConfig,
  WorkflowNode,
  WorkflowNodeType,
} from '@layerto/types';
import { LIMITS, STEP_META } from './definition.ts';

export type StepConfig = WorkflowInputConfig | WorkflowModelConfig | WorkflowConditionConfig | WorkflowForEachConfig | OutputConfig;

/** Node data on the canvas. `issues` are shown on the card and in the inspector. */
export type StepData = { config: StepConfig; issues: string[] };
export type FlowNode = Node<StepData, WorkflowNodeType>;
export type FlowEdge = Edge<{ issue?: string }>;
export type BranchHandle = 'yes' | 'no';

export interface Link {
  source: string;
  sourceHandle?: string | null;
  target: string;
}

// ---------------------------------------------------------------- conversion

export function toFlow(def: WorkflowDefinition): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: def.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { ...n.position },
      data: { config: structuredClone(n.config) as StepConfig, issues: [] },
      deletable: n.type !== 'input' && n.type !== 'output',
    })),
    edges: def.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.source_handle ?? null,
      type: 'step',
    })),
  };
}

export function fromFlow(nodes: FlowNode[], edges: FlowEdge[]): WorkflowDefinition {
  return {
    version: 2,
    nodes: nodes.map(
      (n) =>
        ({
          id: n.id,
          type: n.type,
          position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
          config: n.data.config,
        }) as WorkflowNode,
    ),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle === 'yes' || e.sourceHandle === 'no' ? { source_handle: e.sourceHandle } : {}),
    })),
  };
}

const PREFIX: Record<WorkflowNodeType, string> = { input: 'input', model: 'm', condition: 'c', for_each: 'f', output: 'output' };

/** Next free id like m_3 / c_1 / f_2. */
export function nextNodeId(type: WorkflowNodeType, nodes: { id: string }[]): string {
  const prefix = PREFIX[type];
  let i = 1;
  const taken = new Set(nodes.map((n) => n.id));
  while (taken.has(`${prefix}_${i}`)) i++;
  return `${prefix}_${i}`;
}

export function edgeId(l: Link): string {
  return `e_${l.source}${l.sourceHandle ? `_${l.sourceHandle}` : ''}_${l.target}`;
}

// ---------------------------------------------------------------- connection rules

/** Which step types each step type may connect to. */
export const ALLOWED_TARGETS: Record<WorkflowNodeType, WorkflowNodeType[]> = {
  input: ['model'],
  model: ['model', 'condition', 'for_each', 'output'],
  condition: ['model'],
  for_each: ['model'],
  output: [],
};

/** Steps that accept exactly one incoming connection. */
const SINGLE_INPUT: WorkflowNodeType[] = ['model', 'condition', 'for_each'];

/** Returns why a connection isn't allowed, or null when it is. */
export function connectionProblem(nodes: { id: string; type?: string }[], edges: Link[], link: Link): string | null {
  const src = nodes.find((n) => n.id === link.source);
  const dst = nodes.find((n) => n.id === link.target);
  if (!src || !dst) return 'Unknown step.';
  if (src.id === dst.id) return "A step can't connect to itself.";
  const st = src.type as WorkflowNodeType;
  const dt = dst.type as WorkflowNodeType;
  if (!ALLOWED_TARGETS[st].includes(dt)) return `${STEP_META[st].label} can't connect to ${STEP_META[dt].label}.`;
  if (st === 'condition' && link.sourceHandle !== 'yes' && link.sourceHandle !== 'no') return 'Use the Yes or No output.';
  if (edges.some((e) => e.source === link.source && (e.sourceHandle ?? null) === (link.sourceHandle ?? null) && e.target === link.target)) {
    return 'Already connected.';
  }
  if (SINGLE_INPUT.includes(dt) && edges.some((e) => e.target === dst.id)) return `${STEP_META[dt].label} steps take one incoming connection.`;
  if (createsCycle(edges, link)) return 'That would create a loop. Use “For each object” to repeat work.';
  return null;
}

function createsCycle(edges: Link[], link: Link): boolean {
  const seen = new Set<string>();
  const stack = [link.target];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === link.source) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const e of edges) if (e.source === id) stack.push(e.target);
  }
  return false;
}

/** Step types that can follow a given step (for the “add next step” menu). */
export function nextStepTypes(type: WorkflowNodeType): WorkflowNodeType[] {
  return ALLOWED_TARGETS[type];
}

// ---------------------------------------------------------------- graph analysis

export function topoOrder(def: WorkflowDefinition): string[] | null {
  const indeg = new Map(def.nodes.map((n) => [n.id, 0]));
  for (const e of def.edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  const queue = def.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id).sort();
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of def.edges) {
      if (e.source !== id) continue;
      const d = (indeg.get(e.target) ?? 0) - 1;
      indeg.set(e.target, d);
      if (d === 0) queue.push(e.target);
    }
  }
  return order.length === def.nodes.length ? order : null;
}

/**
 * Fewest and most model calls one image can cause (server: CallBounds).
 * `weight` lets callers count something else per call, e.g. price.
 */
export function callBounds(def: WorkflowDefinition, weight: (n: WorkflowNode) => number = () => 1): { min: number; max: number } {
  const byId = new Map(def.nodes.map((n) => [n.id, n]));
  const out = (id: string, handle?: string) => def.edges.filter((e) => e.source === id && (handle === undefined || e.source_handle === handle));
  const calls = (id: string, mult: number, worst: boolean, depth: number): number => {
    const n = byId.get(id);
    if (!n || depth > LIMITS.maxNodes) return 0;
    const sum = (handle: string | undefined, m: number) => out(id, handle).reduce((t, e) => t + calls(e.target, m, worst, depth + 1), 0);
    switch (n.type) {
      case 'model':
        return mult * weight(n) + sum(undefined, mult);
      case 'condition': {
        const yes = sum('yes', mult);
        const no = sum('no', mult);
        return worst ? Math.max(yes, no) : Math.min(yes, no);
      }
      case 'for_each':
        return worst ? sum(undefined, mult * n.config.max_items) : 0;
      default:
        return 0;
    }
  };
  const input = def.nodes.find((n) => n.type === 'input');
  if (!input) return { min: 0, max: 0 };
  let min = 0;
  let max = 0;
  for (const e of out(input.id)) {
    min += calls(e.target, 1, false, 0);
    max += calls(e.target, 1, true, 0);
  }
  return { min, max };
}

export interface LocalIssues {
  byNode: Record<string, string[]>;
  general: string[];
}

/** Instant checks while editing (the server re-validates everything on save and run). */
export function localIssues(def: WorkflowDefinition, isModelAvailable: (slug: string) => boolean = () => true): LocalIssues {
  const byNode: Record<string, string[]> = {};
  const general: string[] = [];
  const add = (id: string, msg: string) => (byNode[id] ??= []).push(msg);
  const inCount = (id: string) => def.edges.filter((e) => e.target === id).length;
  const outCount = (id: string) => def.edges.filter((e) => e.source === id).length;

  const models = def.nodes.filter((n) => n.type === 'model');
  if (models.length === 0) general.push('Add at least one model step.');
  if (models.length > LIMITS.maxModels) general.push(`At most ${LIMITS.maxModels} model steps.`);
  if (def.nodes.filter((n) => n.type === 'for_each').length > LIMITS.maxForEach) general.push(`At most ${LIMITS.maxForEach} For each steps.`);

  for (const n of def.nodes) {
    switch (n.type) {
      case 'input':
        if (outCount(n.id) === 0) add(n.id, 'Connect Input to a model step.');
        break;
      case 'model':
        if (!n.config.model_slug) add(n.id, 'Choose a model.');
        else if (!isModelAvailable(n.config.model_slug)) add(n.id, 'This model is disabled or no longer exists.');
        if (inCount(n.id) === 0) add(n.id, 'Connect something into this step.');
        if (outCount(n.id) === 0) add(n.id, 'Connect this step to Output or another step.');
        break;
      case 'condition':
        if (inCount(n.id) === 0) add(n.id, 'Connect a model step into this condition.');
        if (outCount(n.id) === 0) add(n.id, 'Connect Yes or No to a model step.');
        if (n.config.rule === 'count_at_least' && n.config.count < 1) add(n.id, 'Count must be at least 1.');
        break;
      case 'for_each':
        if (inCount(n.id) === 0) add(n.id, 'Connect a model step into this loop.');
        if (outCount(n.id) === 0) add(n.id, 'Connect the model to run on each object.');
        break;
      case 'output':
        if (inCount(n.id) === 0) add(n.id, 'Connect at least one model step to Output.');
        if (n.config.fields.length === 0) add(n.id, 'Pick at least one field.');
        break;
    }
  }

  const order = topoOrder(def);
  if (!order) {
    general.push('The workflow has a loop of connections.');
  } else {
    const input = def.nodes.find((n) => n.type === 'input');
    const reach = new Set(input ? [input.id] : []);
    for (const id of order) if (reach.has(id)) for (const e of def.edges) if (e.source === id) reach.add(e.target);
    for (const n of def.nodes) if (!reach.has(n.id) && n.type !== 'input' && !(byNode[n.id]?.length)) add(n.id, 'Not connected to Input.');
    const { max } = callBounds(def);
    if (max > LIMITS.maxCallsPerImage) general.push(`Up to ${max} model calls per image (limit ${LIMITS.maxCallsPerImage}). Lower “max objects” in a loop.`);
  }
  return { byNode, general };
}

// ---------------------------------------------------------------- layout

const COL = 340;
const ROW = 150;

/** Tidy left-to-right layout: columns by depth from Input, rows in connection order. */
export function autoLayout(nodes: FlowNode[], edges: Link[]): FlowNode[] {
  const depth = new Map<string, number>();
  const input = nodes.find((n) => n.type === 'input');
  if (!input) return nodes;
  depth.set(input.id, 0);
  let changed = true;
  for (let guard = 0; changed && guard < nodes.length + 2; guard++) {
    changed = false;
    for (const e of edges) {
      const d = depth.get(e.source);
      if (d === undefined) continue;
      if ((depth.get(e.target) ?? -1) < d + 1) {
        depth.set(e.target, d + 1);
        changed = true;
      }
    }
  }
  const maxDepth = Math.max(0, ...depth.values());
  const output = nodes.find((n) => n.type === 'output');
  if (output) depth.set(output.id, Math.max(maxDepth, 1));
  let orphanDepth = maxDepth + 1;
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, orphanDepth++);

  const columns = new Map<number, FlowNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    columns.set(d, [...(columns.get(d) ?? []), n]);
  }
  const rowOf = new Map<string, number>();
  const result = new Map<string, { x: number; y: number }>();
  for (const d of [...columns.keys()].sort((a, b) => a - b)) {
    const col = columns.get(d)!;
    // Order by the average row of parents, so branches stay near their source.
    col.sort((a, b) => parentRow(a.id) - parentRow(b.id));
    col.forEach((n, i) => {
      rowOf.set(n.id, i);
      result.set(n.id, { x: d * COL, y: (i - (col.length - 1) / 2) * ROW + 200 });
    });
  }
  function parentRow(id: string): number {
    const parents = edges.filter((e) => e.target === id).map((e) => (rowOf.get(e.source) ?? 0) + (e.sourceHandle === 'no' ? 0.5 : 0));
    return parents.length ? parents.reduce((a, b) => a + b, 0) / parents.length : 0;
  }
  return nodes.map((n) => ({ ...n, position: result.get(n.id) ?? n.position }));
}
