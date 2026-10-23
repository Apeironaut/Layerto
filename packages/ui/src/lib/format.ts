/** Trims trailing zeros but keeps at least two decimals: "0.002000" → "0.002", "15.000000" → "15.00". */
function trim(n: string): string {
  const m = n.match(/^(\d+)\.(\d*?)0*$/);
  if (!m) return n;
  const dec = m[2].length < 2 ? m[2].padEnd(2, '0') : m[2];
  return `${m[1]}.${dec}`;
}

/** Shows an API amount string ("0.002000") as dollars ("$0.002"). Leaves "$…" as is. */
export function usd(amount: string | undefined | null): string {
  if (!amount) return '$0.00';
  if (amount.startsWith('$') || amount.startsWith('-$')) return amount;
  return amount.startsWith('-') ? `-$${trim(amount.slice(1))}` : `$${trim(amount)}`;
}
