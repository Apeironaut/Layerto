import type { AdminKeyItem } from '@layerto/types';
import { Chip, formatExpiryDisplay, getKeyStatus, isKeyExpired, timeLeft, useNow } from '@layerto/ui';

/** A user's API keys with live status and expiry countdown (read-only). */
export function UserKeysList({ keys }: { keys: AdminKeyItem[] }) {
  const now = useNow();
  if (keys.length === 0) return <p className="text-sm text-muted">No API keys yet.</p>;
  return (
    <ul className="divide-y divide-line rounded-control border border-line bg-page">
      {keys.map((k) => {
        const status = getKeyStatus(k, now);
        const tone = status.variant === 'danger' ? 'text-crimson' : status.variant === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-muted';
        return (
          <li key={k.id} className={`flex items-start justify-between gap-3 px-3 py-2.5 ${k.revoked_at ? 'opacity-60' : ''}`}>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{k.name}</div>
              <div className="font-mono text-xs text-muted">{k.prefix}_…</div>
              <div className="mt-1 text-xs text-muted">
                Created {new Date(k.created_at).toLocaleDateString()} · Last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'never'}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <Chip variant={status.variant}>{status.label}</Chip>
              <div className="mt-1 text-xs text-ink-secondary" title={k.expires_at ? new Date(k.expires_at).toLocaleString() : 'Never expires'}>
                {k.expires_at ? `${isKeyExpired(k.expires_at, now) ? 'Expired on' : 'Expires'} ${formatExpiryDisplay(k.expires_at)}` : 'Never expires'}
              </div>
              {!k.revoked_at && k.expires_at && <div className={`text-xs tabular-nums ${tone}`}>{timeLeft(k.expires_at, now)}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
