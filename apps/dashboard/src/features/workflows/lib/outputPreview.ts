import type { BBoxFormat, OutputConfig, WorkflowField } from '@layerto/types';
import { FIELD_ORDER } from './definition.ts';

/**
 * Builds an EXAMPLE of what the API returns for an output config, using made-up
 * predictions. It mirrors services/core/internal/workflows/shape.go so the shape matches.
 */

export interface PreviewStep {
  name: string;
  /** True when the step runs inside a For each loop (results get a parent). */
  inLoop: boolean;
}

interface ExampleRow {
  step: string;
  model: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  parent?: { step: string; label: string; confidence: number; bbox: [number, number, number, number] };
}

const IMAGE = { width: 640, height: 480 };

function round(n: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

export function formatConfidence(c: number, cfg: OutputConfig): number {
  return cfg.confidence_format === 'percent' ? round(c * 100, cfg.decimals) : round(c, cfg.decimals);
}

export function formatBBox(b: [number, number, number, number], format: BBoxFormat, size = IMAGE): number[] {
  const [x, y, w, h] = b;
  switch (format) {
    case 'xyxy':
      return [x, y, x + w, y + h];
    case 'normalized_xywh':
      return [round(x / size.width, 6), round(y / size.height, 6), round(w / size.width, 6), round(h / size.height, 6)];
    case 'center_xywh':
      return [x + w / 2, y + h / 2, w, h];
    default:
      return [x, y, w, h];
  }
}

export function bboxColumns(format: BBoxFormat): string[] {
  if (format === 'xyxy') return ['x1', 'y1', 'x2', 'y2'];
  if (format === 'center_xywh') return ['cx', 'cy', 'w', 'h'];
  return ['x', 'y', 'w', 'h'];
}

export function selectedFields(cfg: OutputConfig): WorkflowField[] {
  return FIELD_ORDER.filter((f) => cfg.fields.includes(f));
}

export function fieldName(cfg: OutputConfig, f: WorkflowField): string {
  return cfg.rename[f] || f;
}

function exampleRows(steps: PreviewStep[]): ExampleRow[] {
  const rows: ExampleRow[] = [];
  steps.forEach((s, i) => {
    const base = 40 + i * 30;
    const row: ExampleRow = {
      step: s.name,
      model: 'example-model',
      label: `example label ${i + 1}`,
      confidence: 0.9234 - i * 0.07,
      bbox: [base, base + 16, 120, 96],
    };
    if (s.inLoop) row.parent = { step: 'detector', label: 'example object', confidence: 0.8811, bbox: [base - 8, base, 150, 130] };
    rows.push(row);
  });
  return rows;
}

function renderRow(r: ExampleRow, cfg: OutputConfig): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const f of selectedFields(cfg)) {
    let v: unknown = null;
    switch (f) {
      case 'label': v = r.label; break;
      case 'confidence': v = formatConfidence(r.confidence, cfg); break;
      case 'bbox': v = formatBBox(r.bbox, cfg.bbox_format); break;
      case 'step': v = r.step; break;
      case 'model': v = r.model; break;
      case 'model_version': v = '1.0.0'; break;
      case 'parent':
        v = r.parent
          ? { step: r.parent.step, label: r.parent.label, confidence: formatConfidence(r.parent.confidence, cfg), bbox: formatBBox(r.parent.bbox, cfg.bbox_format) }
          : null;
        break;
      case 'latency_ms': v = 184; break;
      case 'request_id': v = 'req_…'; break;
      case 'charge_usd': v = '0.001500'; break;
    }
    o[fieldName(cfg, f)] = v;
  }
  return o;
}

/** Example response as pretty JSON or CSV text. */
export function buildPreview(cfg: OutputConfig, steps: PreviewStep[]): string {
  const visible = steps.length ? steps : [{ name: 'model step', inLoop: false }];
  const rows = exampleRows(visible);

  if (cfg.format === 'csv') {
    const header = ['image_index'];
    for (const f of selectedFields(cfg)) {
      if (f === 'bbox') header.push(...bboxColumns(cfg.bbox_format).map((c) => `${fieldName(cfg, f)}_${c}`));
      else if (f === 'parent') header.push(`${fieldName(cfg, f)}_label`, `${fieldName(cfg, f)}_confidence`);
      else header.push(fieldName(cfg, f));
    }
    const lines = [header.join(',')];
    for (const r of rows) {
      const rec = ['0'];
      const rendered = renderRow(r, cfg);
      for (const f of selectedFields(cfg)) {
        const v = rendered[fieldName(cfg, f)];
        if (f === 'bbox') rec.push(...(v as number[]).map(String));
        else if (f === 'parent') rec.push(r.parent ? r.parent.label : '', r.parent ? String(formatConfidence(r.parent.confidence, cfg)) : '');
        else rec.push(String(v ?? ''));
      }
      lines.push(rec.join(','));
    }
    return lines.join('\n');
  }

  const resp: Record<string, unknown> = { workflow_id: '…', run_id: '…' };
  const errors: unknown[] = [];
  if (cfg.layout === 'flat') {
    resp.results = rows.map((r) => ({ image_index: 0, ...renderRow(r, cfg) }));
    if (cfg.include_errors) resp.errors = errors;
  } else {
    const image: Record<string, unknown> = { index: 0 };
    if (cfg.include_image_info) Object.assign(image, IMAGE);
    if (cfg.layout === 'by_step') {
      const byStep: Record<string, unknown[]> = {};
      for (const s of visible) byStep[s.name] = rows.filter((r) => r.step === s.name).map((r) => renderRow(r, cfg));
      image.steps = byStep;
    } else {
      image.results = rows.map((r) => renderRow(r, cfg));
    }
    if (cfg.include_errors) image.errors = errors;
    resp.images = [image];
  }
  if (cfg.include_summary) {
    resp.summary = {
      images: 1,
      predictions: rows.length,
      model_calls: rows.length,
      failed_calls: 0,
      label_counts: Object.fromEntries(rows.map((r) => [r.label, 1])),
      total_charge_usd: '0.00' + String(rows.length * 15).padStart(4, '0'),
    };
  }
  resp.total_charge_usd = resp.summary ? (resp.summary as { total_charge_usd: string }).total_charge_usd : '0.001500';
  return JSON.stringify(resp, null, 2);
}
