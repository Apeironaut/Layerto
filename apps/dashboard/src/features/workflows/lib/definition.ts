import type {
  BBoxFormat,
  OutputConfig,
  Workflow,
  WorkflowConditionConfig,
  WorkflowDefinition,
  WorkflowField,
  WorkflowForEachConfig,
  WorkflowInputConfig,
  WorkflowLayout,
  WorkflowModelConfig,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowSort,
} from '@layerto/types';
import type { IconName } from '@layerto/ui';

/** Limits shared with the server (services/core/internal/workflows/validate.go). */
export const LIMITS = {
  maxImages: 20,
  maxModels: 12,
  maxForEach: 3,
  maxForEachDepth: 2,
  maxCallsPerImage: 100,
  maxNodes: 30,
  maxLabels: 50,
} as const;

export const STEP_META: Record<WorkflowNodeType, { label: string; description: string; icon: IconName }> = {
  input: { label: 'Input', description: 'The image or batch of images you send.', icon: 'image' },
  model: { label: 'Model', description: 'Runs a model on the image (or crop) it receives.', icon: 'cpu' },
  condition: { label: 'Condition', description: 'Checks the previous step’s results and continues on Yes or No.', icon: 'branch' },
  for_each: { label: 'For each object', description: 'Crops every detected object and runs the next step on each one.', icon: 'repeat' },
  output: { label: 'Output', description: 'Shapes what the API returns.', icon: 'output' },
};

export const FIELD_META: Record<WorkflowField, { label: string; description: string }> = {
  label: { label: 'Label', description: 'What was found, e.g. “Chelonia mydas”.' },
  confidence: { label: 'Confidence', description: 'How sure the model is.' },
  bbox: { label: 'Box', description: 'Where it is in the image.' },
  step: { label: 'Step', description: 'Which step produced it (its name).' },
  model: { label: 'Model', description: 'The model slug.' },
  model_version: { label: 'Model version', description: 'Exact model version used.' },
  parent: { label: 'Parent object', description: 'For results inside a For each loop: the object it was cropped from.' },
  latency_ms: { label: 'Latency', description: 'Model time in milliseconds.' },
  request_id: { label: 'Request ID', description: 'For support and billing lookups.' },
  charge_usd: { label: 'Charge', description: 'What that model call cost.' },
};

/** Canonical field order, as the server returns them. */
export const FIELD_ORDER: WorkflowField[] = ['label', 'confidence', 'bbox', 'step', 'model', 'model_version', 'parent', 'latency_ms', 'request_id', 'charge_usd'];

export const BBOX_FORMATS: { value: BBoxFormat; label: string; hint: string }[] = [
  { value: 'xywh', label: 'x, y, width, height', hint: 'Pixels from the top-left corner.' },
  { value: 'xyxy', label: 'x1, y1, x2, y2', hint: 'Top-left and bottom-right corners.' },
  { value: 'center_xywh', label: 'center x, center y, w, h', hint: 'YOLO-style centre point.' },
  { value: 'normalized_xywh', label: 'normalized 0–1', hint: 'Divided by the image width and height.' },
];

export const LAYOUTS: { value: WorkflowLayout; label: string; hint: string }[] = [
  { value: 'by_image', label: 'By image', hint: 'One list of results per image.' },
  { value: 'by_step', label: 'By step', hint: 'Per image, grouped under each step’s name.' },
  { value: 'flat', label: 'Flat list', hint: 'One list for everything, with an image index.' },
];

export const SORTS: { value: WorkflowSort; label: string }[] = [
  { value: 'confidence_desc', label: 'Most confident first' },
  { value: 'label_asc', label: 'Label A–Z' },
  { value: 'step', label: 'By step order' },
];

export function defaultOutputConfig(): OutputConfig {
  return {
    fields: ['label', 'confidence', 'bbox', 'step'],
    rename: {},
    min_confidence: 0,
    labels_include: [],
    labels_exclude: [],
    top_k: null,
    sort: 'confidence_desc',
    confidence_format: 'decimal',
    decimals: 4,
    bbox_format: 'xywh',
    layout: 'by_image',
    include_summary: true,
    include_errors: true,
    include_image_info: true,
    include_empty: true,
    format: 'json',
  };
}

export const defaultInputConfig = (): WorkflowInputConfig => ({ mode: 'batch', max_images: 10 });
export const defaultModelConfig = (slug: string): WorkflowModelConfig => ({ model_slug: slug, min_confidence: 0, label: '' });
export const defaultConditionConfig = (): WorkflowConditionConfig => ({ rule: 'has_label', labels: [], min_confidence: 0.5, count: 0 });
export const defaultForEachConfig = (): WorkflowForEachConfig => ({ labels: [], min_confidence: 0.5, max_items: 5, padding_pct: 10 });

/** A new workflow: Input → first model → Output. */
export function newDefinition(firstModelSlug: string | undefined): WorkflowDefinition {
  const nodes: WorkflowNode[] = [{ id: 'input', type: 'input', position: { x: 0, y: 120 }, config: defaultInputConfig() }];
  const edges: WorkflowDefinition['edges'] = [];
  if (firstModelSlug) {
    nodes.push({ id: 'm_1', type: 'model', position: { x: 340, y: 120 }, config: defaultModelConfig(firstModelSlug) });
    edges.push({ id: 'e_input_m_1', source: 'input', target: 'm_1' }, { id: 'e_m_1_output', source: 'm_1', target: 'output' });
  }
  nodes.push({ id: 'output', type: 'output', position: { x: firstModelSlug ? 680 : 340, y: 120 }, config: defaultOutputConfig() });
  return { version: 2, nodes, edges };
}

interface V1Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

/** Saved version 1 workflows (input → models → output) open as version 2, like the server does. */
export function upgradeDefinition(def: Workflow['definition']): WorkflowDefinition {
  if (def.version === 2) return def;
  const nodes = (def.nodes as V1Node[]).map((n): WorkflowNode => {
    if (n.type === 'input') return { id: n.id, type: 'input', position: n.position, config: n.config as unknown as WorkflowInputConfig };
    if (n.type === 'model') {
      const c = n.config as { model_slug?: string; min_confidence?: number };
      return { id: n.id, type: 'model', position: n.position, config: { model_slug: c.model_slug ?? '', min_confidence: c.min_confidence ?? 0, label: '' } };
    }
    const old = n.config as { fields?: string[]; min_confidence?: number; labels_include?: string[]; top_k?: number | null; bbox_format?: string; merge_models?: boolean; include_summary?: boolean; format?: string };
    const c = defaultOutputConfig();
    if (old.fields?.length) c.fields = old.fields.map((f) => (f === 'model' ? 'step' : f)).filter((f): f is WorkflowField => f in FIELD_META);
    c.min_confidence = old.min_confidence ?? 0;
    c.labels_include = old.labels_include ?? [];
    c.top_k = old.top_k ?? null;
    if (BBOX_FORMATS.some((b) => b.value === old.bbox_format)) c.bbox_format = old.bbox_format as BBoxFormat;
    if (old.merge_models === false) c.layout = 'by_step';
    c.include_summary = old.include_summary ?? true;
    if (old.format === 'csv') c.format = 'csv';
    return { id: n.id, type: 'output', position: n.position, config: c };
  });
  return { version: 2, nodes, edges: def.edges as WorkflowDefinition['edges'] };
}
