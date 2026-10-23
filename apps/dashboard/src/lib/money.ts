/** Formats integer micro-USD as an exact 6-decimal dollar string, e.g. 2000 → "$0.002000". */
export function formatMicroUsd(micro: number): string {
  const sign = micro < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(micro));
  const whole = Math.floor(abs / 1_000_000);
  const frac = String(abs % 1_000_000).padStart(6, '0');
  return `${sign}$${whole.toLocaleString('en-US')}.${frac}`;
}

/** Parses an API dollar string like "$4.200000" or "4.2" into a number for display animation. */
export function dollarsToNumber(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(value.replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
