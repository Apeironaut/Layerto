import type { LedgerVerifyResult } from '@layerto/types';
import { Icon } from '@layerto/ui';

/** Outcome of a ledger verification run. */
export function LedgerResult({ result, checkedAt }: { result: LedgerVerifyResult; checkedAt: Date }) {
  const ok = result.ok;
  return (
    <div
      role="status"
      className={`flex items-start gap-4 rounded-l2 border p-5 ${ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-crimson-border bg-crimson-tint'}`}
    >
      <span className={`mt-0.5 ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-crimson'}`}>
        <Icon name={ok ? 'check' : 'alert'} size={22} />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">{ok ? 'Ledger is intact' : 'Ledger check failed'}</p>
        <p className="text-sm text-ink-secondary">
          Checked {result.checked.toLocaleString()} events.
          {!ok && result.first_bad_seq !== undefined && <> The first mismatch is at event #{result.first_bad_seq}.</>}
        </p>
        {!ok && (
          <p className="text-sm text-ink-secondary">
            Don't edit the events table. Investigate from that event and record any correction as a new event.
          </p>
        )}
        <p className="text-xs text-muted">Run at {checkedAt.toLocaleString()}</p>
      </div>
    </div>
  );
}
