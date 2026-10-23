import type { OutputConfig, WorkflowResultRow, WorkflowRunResponse } from '@layerto/types';

export interface DrawnBox {
  label: string;
  confidence: number; // 0..1
  bbox: [number, number, number, number]; // x, y, w, h in pixels
}

/** Converts a returned box (in the chosen format) back to pixel x, y, w, h. */
export function toPixelBox(raw: unknown, format: OutputConfig['bbox_format'], size: { width: number; height: number }): [number, number, number, number] | null {
  if (!Array.isArray(raw) || raw.length !== 4 || raw.some((n) => typeof n !== 'number')) return null;
  const [a, b, c, d] = raw as number[];
  switch (format) {
    case 'xyxy':
      return [a, b, c - a, d - b];
    case 'center_xywh':
      return [a - c / 2, b - d / 2, c, d];
    case 'normalized_xywh':
      return [a * size.width, b * size.height, c * size.width, d * size.height];
    default:
      return [a, b, c, d];
  }
}

function rowsByImage(res: WorkflowRunResponse): Map<number, WorkflowResultRow[]> {
  const map = new Map<number, WorkflowResultRow[]>();
  if (res.results) {
    for (const r of res.results) {
      const i = typeof r.image_index === 'number' ? r.image_index : 0;
      map.set(i, [...(map.get(i) ?? []), r]);
    }
  }
  for (const img of res.images ?? []) {
    const rows = img.results ?? Object.values(img.steps ?? {}).flat();
    map.set(img.index, [...(map.get(img.index) ?? []), ...rows]);
  }
  return map;
}

/**
 * Boxes to draw per image index, read back from a JSON response using the output
 * config's field names. Empty when the box field isn't returned.
 */
export function boxesForImages(res: WorkflowRunResponse, cfg: OutputConfig, sizes: { width: number; height: number }[]): Map<number, DrawnBox[]> {
  const out = new Map<number, DrawnBox[]>();
  if (!cfg.fields.includes('bbox')) return out;
  const key = (f: 'bbox' | 'label' | 'confidence') => cfg.rename[f] || f;
  for (const [i, rows] of rowsByImage(res)) {
    const size = sizes[i] ?? { width: 1, height: 1 };
    const boxes: DrawnBox[] = [];
    for (const r of rows) {
      const bbox = toPixelBox(r[key('bbox')], cfg.bbox_format, size);
      if (!bbox) continue;
      const rawConf = Number(r[key('confidence')] ?? 1);
      const confidence = cfg.confidence_format === 'percent' ? rawConf / 100 : rawConf;
      boxes.push({ label: String(r[key('label')] ?? ''), confidence: Number.isFinite(confidence) ? confidence : 1, bbox });
    }
    out.set(i, boxes);
  }
  return out;
}
