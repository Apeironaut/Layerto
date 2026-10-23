/** Agent → policy check → tool, shown as three stacked layers. */
const STEPS = [
  { t: 'The agent wants to act', s: 'refund_order(amount: 120)' },
  { t: 'Charon checks your rules', s: 'over 100 → ask a person' },
  { t: 'Approved, run, recorded', s: 'event #4182 · approved by ops' },
];

export function CharonVisual() {
  return (
    <ol className="w-full flex flex-col gap-3" aria-label="How Charon handles an action">
      {STEPS.map((st, i) => (
        <li
          key={st.t}
          className={`rounded-l2 border p-5 ${i === 1 ? 'bg-crimson dark:bg-crimson-fill text-white border-transparent shadow-l2' : 'bg-page border-line'}`}
          style={{ marginLeft: `${i * 6}%` }}
        >
          <div className={`font-semibold ${i === 1 ? '!text-white' : 'text-ink'}`}>{st.t}</div>
          <div className={`mt-1 font-mono text-xs ${i === 1 ? 'text-white/80' : 'text-muted'}`}>{st.s}</div>
        </li>
      ))}
      <li className="text-xs text-muted list-none">Illustrative example. Charon is not released yet.</li>
    </ol>
  );
}
