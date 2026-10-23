/** How one call is charged: hold → run → charge or refund. */
const STAGES = [
  { title: 'Call starts', body: 'The model price is held from your free calls or balance.', tone: 'neutral' },
  { title: 'Model succeeds', body: 'The held amount is charged. That is the only time you pay.', tone: 'ok' },
  { title: 'Model fails', body: 'The held amount is returned in full.', tone: 'back' },
] as const;

export function ChargeFlow() {
  return (
    <div className="rounded-l1 border border-line bg-card p-6 sm:p-8">
      <h3 className="text-xl font-bold">How a call is charged</h3>
      <ol className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr] gap-4 items-stretch">
        {STAGES.map((s, i) => (
          <li key={s.title} className="contents">
            {i === 1 && (
              <span aria-hidden="true" className="hidden md:flex items-center text-2xl text-muted">
                →
              </span>
            )}
            <div
              className={`rounded-l2 border p-5 ${
                s.tone === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10' : s.tone === 'back' ? 'border-crimson-border bg-crimson-tint' : 'border-line bg-page'
              }`}
            >
              <div className="font-semibold">{s.title}</div>
              <p className="mt-1 text-sm text-ink-secondary">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
