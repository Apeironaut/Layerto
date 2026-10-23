/** Exact money helpers for the pricing section. The API sends prices as "0.001500" (dollars, 6 places). */

export const FREE_CALLS = 50;

/** "0.001500" → 1500 micro-USD. Returns 0 for anything unparseable. */
export function toMicro(amount: string): number {
  const m = amount.replace(/^\$/, '').match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!m) return 0;
  return Number(m[1]) * 1_000_000 + Number((m[2] ?? '').padEnd(6, '0'));
}

/** 1425000 → "$1.425000" (exact, with thousands separators). */
export function formatMicro(micro: number): string {
  const whole = Math.floor(micro / 1_000_000);
  return `$${whole.toLocaleString('en-US')}.${String(micro % 1_000_000).padStart(6, '0')}`;
}

/** Cost of `calls` calls at `priceMicro` each, after `free` free calls. */
export function estimateMicro(calls: number, priceMicro: number, free: number): { paidCalls: number; micro: number } {
  const paidCalls = Math.max(0, Math.floor(calls) - free);
  return { paidCalls, micro: paidCalls * priceMicro };
}
