import type { OutputConfig, WorkflowDefinition, WorkflowEdge, WorkflowNode } from '@layerto/types';
import type { ModelVersionItem } from '@layerto/types';

export interface ChainStepConfig {
  id: string;
  model_slug: string;
  min_confidence: number;
  prompt: string;
}

export interface MetricPoint {
  version: string;
  date: string;
  value: number;
  formattedValue: string;
  status: string;
  notes?: string;
}

export interface GraphLayout {
  pathD: string;
  areaD: string;
  coords: Array<{ x: number; y: number; point: MetricPoint }>;
  minValue: number;
  maxValue: number;
}

const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  fields: ['label', 'confidence', 'bbox', 'step', 'model', 'latency_ms', 'charge_usd'],
  rename: {},
  min_confidence: 0.2,
  labels_include: [],
  labels_exclude: [],
  top_k: null,
  sort: 'confidence_desc',
  confidence_format: 'percent',
  decimals: 1,
  bbox_format: 'xywh',
  layout: 'flat',
  include_summary: true,
  include_errors: true,
  include_image_info: true,
  include_empty: false,
  format: 'json',
};

/**
 * Serializes an ordered chain of playground model steps into a fully valid Layerto WorkflowDefinition DAG.
 */
export function serializeChainToWorkflow(steps: ChainStepConfig[]): WorkflowDefinition {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];

  const inputId = 'node_input_0';
  nodes.push({
    id: inputId,
    type: 'input',
    position: { x: 80, y: 150 },
    config: {
      mode: 'single',
      max_images: 1,
    },
  });

  let prevNodeId = inputId;

  steps.forEach((step, index) => {
    const modelNodeId = `node_model_${index + 1}`;
    nodes.push({
      id: modelNodeId,
      type: 'model',
      position: { x: 80 + (index + 1) * 240, y: 150 },
      config: {
        model_slug: step.model_slug,
        min_confidence: step.min_confidence,
        label: step.prompt.trim(),
      },
    });

    edges.push({
      id: `edge_${prevNodeId}_to_${modelNodeId}`,
      source: prevNodeId,
      target: modelNodeId,
    });

    prevNodeId = modelNodeId;
  });

  const outputId = `node_output_${steps.length + 1}`;
  nodes.push({
    id: outputId,
    type: 'output',
    position: { x: 80 + (steps.length + 1) * 240, y: 150 },
    config: { ...DEFAULT_OUTPUT_CONFIG },
  });

  edges.push({
    id: `edge_${prevNodeId}_to_${outputId}`,
    source: prevNodeId,
    target: outputId,
  });

  return { version: 2, nodes, edges };
}

/**
 * Formats a metric value cleanly according to its key.
 */
export function formatMetricValue(key: string, val: number | string): string {
  if (typeof val === 'number') {
    if (key.includes('acc') || key.includes('map') || key.includes('precision') || key.includes('recall') || key.includes('f1')) {
      return `${(val * 100).toFixed(1)}%`;
    }
    if (key.includes('ms') || key.includes('latency')) {
      return `${Math.round(val)} ms`;
    }
    return val.toLocaleString();
  }
  return String(val);
}

/**
 * Extracts and sorts version metrics chronologically for time-series visualization.
 */
export function parseVersionMetrics(versions?: ModelVersionItem[], preferredKey?: string): MetricPoint[] {
  if (!versions || versions.length === 0) return [];

  // Sort chronologically ascending
  const sorted = [...versions].sort((a, b) => {
    const dateA = new Date(a.released_at).getTime();
    const dateB = new Date(b.released_at).getTime();
    return dateA - dateB;
  });

  // Find candidate numeric metric key
  let metricKey = preferredKey;
  if (!metricKey) {
    const firstWithMetrics = sorted.find((v) => v.metrics && Object.keys(v.metrics).length > 0);
    if (firstWithMetrics) {
      const keys = Object.keys(firstWithMetrics.metrics);
      metricKey = keys.find((k) => typeof firstWithMetrics.metrics[k] === 'number' && !k.includes('ms')) ?? keys[0];
    }
  }

  if (!metricKey) return [];

  return sorted
    .filter((v) => v.metrics && typeof v.metrics[metricKey!] === 'number')
    .map((v) => {
      const val = v.metrics[metricKey!] as number;
      return {
        version: v.version,
        date: v.released_at,
        value: val,
        formattedValue: formatMetricValue(metricKey!, val),
        status: v.status,
        notes: v.notes,
      };
    });
}

/**
 * Computes SVG coordinates and path strings for the metrics fluctuation chart.
 */
export function calculateGraphCoordinates(
  points: MetricPoint[],
  width = 360,
  height = 140,
  padding = 24,
): GraphLayout {
  if (points.length === 0) {
    return { pathD: '', areaD: '', coords: [], minValue: 0, maxValue: 1 };
  }

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);

  // If min and max are identical or very close, expand range slightly
  if (min === max) {
    min = Math.max(0, min - 0.1);
    max = max + 0.1;
  } else {
    const range = max - min;
    min = Math.max(0, min - range * 0.15);
    max = max + range * 0.15;
  }

  const effectiveWidth = Math.max(width - padding * 2, 10);
  const effectiveHeight = Math.max(height - padding * 2, 10);

  const coords = points.map((p, idx) => {
    const x = points.length === 1 ? padding + effectiveWidth / 2 : padding + (idx / (points.length - 1)) * effectiveWidth;
    const normalizedY = (p.value - min) / (max - min);
    const y = padding + (1 - normalizedY) * effectiveHeight;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, point: p };
  });

  const pathD = coords.reduce((acc, c, idx) => {
    return idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`;
  }, '');

  const firstX = coords[0].x;
  const lastX = coords[coords.length - 1].x;
  const bottomY = height - padding;
  const areaD = `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

  return {
    pathD,
    areaD,
    coords,
    minValue: min,
    maxValue: max,
  };
}
