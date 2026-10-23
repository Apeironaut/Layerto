/** The four billing rules, in plain words. */
const RULES = [
  { n: '50', title: 'Free calls to start', body: 'Every approved account gets 50 free calls, once, on any model. No card needed.' },
  { n: '$/call', title: 'Pay as you go', body: 'After that, each call costs the price of the model you used. It comes out of a prepaid balance. No subscription, no minimum.' },
  { n: '$0', title: 'Failed calls cost nothing', body: 'If a model errors or times out, the amount held for the call goes straight back, and a free call is not used up.' },
  { n: '6dp', title: 'Exact to the micro-dollar', body: 'Charges are counted in millionths of a dollar, so small per-call prices add up exactly. Every charge is in your request history.' },
];

export function BillingRules() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {RULES.map((r) => (
        <div key={r.title} className="rounded-l1 border border-line bg-card p-6 transition-colors hover:border-crimson-border">
          <div className="text-3xl font-bold text-crimson tabular-nums">{r.n}</div>
          <h3 className="mt-3 text-lg font-bold">{r.title}</h3>
          <p className="mt-2 text-sm text-ink-secondary leading-relaxed">{r.body}</p>
        </div>
      ))}
    </div>
  );
}
