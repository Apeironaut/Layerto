/**
 * Parses a dollar amount typed by an admin ("5", "0.25", "0.000150") into exact
 * micro-USD. Returns null if it isn't a plain positive decimal with ≤ 6 places.
 * Never goes through floating point, so the preview matches what the server books.
 */
export function parseUsdToMicro(input: string): number | null {
  const match = input.trim().match(/^(\d+)(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  const whole = Number(match[1]);
  const frac = Number((match[2] ?? '').padEnd(6, '0'));
  const micro = whole * 1_000_000 + frac;
  return Number.isSafeInteger(micro) && micro > 0 ? micro : null;
}

/** Formats micro-USD exactly, e.g. 150 → "$0.000150". */
export function formatMicro(micro: number): string {
  const whole = Math.floor(micro / 1_000_000);
  const frac = String(micro % 1_000_000).padStart(6, '0');
  return `$${whole.toLocaleString('en-US')}.${frac}`;
}
