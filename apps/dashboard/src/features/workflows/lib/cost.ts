import type { PublicModelItem, WorkflowDefinition } from '@layerto/types';
import { callBounds } from './graph.ts';

/** "0.001500" → 1500 micro-USD (0 if unparseable). */
export function toMicro(amount: string): number {
  const m = amount.replace(/^\$/, '').match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!m) return 0;
  return Number(m[1]) * 1_000_000 + Number((m[2] ?? '').padEnd(6, '0'));
}

export function formatMicro(micro: number): string {
  return `$${Math.floor(micro / 1_000_000).toLocaleString('en-US')}.${String(micro % 1_000_000).padStart(6, '0')}`;
}

/** Cheapest and most expensive cost of one image, in micro-USD, at live model prices. */
export function costPerImage(def: WorkflowDefinition, models: PublicModelItem[]): { min: number; max: number } {
  const price = new Map(models.map((m) => [m.slug, toMicro(m.price_usd)]));
  return callBounds(def, (n) => (n.type === 'model' ? (price.get(n.config.model_slug) ?? 0) : 0));
}

/** "$0.0015" or "$0.0015–$0.0090". */
export function formatRange(r: { min: number; max: number }): string {
  return r.min === r.max ? formatMicro(r.min) : `${formatMicro(r.min)}–${formatMicro(r.max)}`;
}
