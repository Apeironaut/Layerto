/** Human-readable byte size. */
export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/** mAP as a percentage, or a dash when the metric is missing. */
export function pct(v: number | null | undefined): string {
  return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—';
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** "in 2 days", "in 5 hours", "now". */
export function fromNow(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'now';
  const h = ms / 3_600_000;
  if (h < 1) return `in ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (h < 48) return `in ${Math.round(h)} h`;
  return `in ${Math.round(h / 24)} days`;
}

/** Splits "cat, dog\nbird" into unique trimmed class names. */
export function parseClasses(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const c = raw.trim();
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/** Stable, readable colour for class index i. */
export const CLASS_COLORS = ['#E11D48', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#4F46E5'];
export function classColor(i: number): string {
  return CLASS_COLORS[((i % CLASS_COLORS.length) + CLASS_COLORS.length) % CLASS_COLORS.length];
}
