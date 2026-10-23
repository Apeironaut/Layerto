import type { ApiKeyItem } from '@layerto/types';
import { Button, Chip, Table, THead, Th, Tr, Td, formatExpiryDisplay, getKeyStatus, timeLeft } from '@layerto/ui';
import { formatRelativeTime } from '../../lib/time';

function date(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString() : 'Never';
}

export interface KeysTableProps {
  keys: ApiKeyItem[];
  onRevoke: (key: ApiKeyItem) => void;
  /** Ticking clock (see useNow) so the countdown and status update while the page is open. */
  now: Date;
}

/** All keys with a live status and expiry countdown; non-revoked keys can be revoked. */
export function KeysTable({ keys, onRevoke, now }: KeysTableProps) {
  return (
    <Table label="API keys">
      <THead>
        <Th>Name</Th>
        <Th>Key</Th>
        <Th>Status</Th>
        <Th>Created</Th>
        <Th>Expires</Th>
        <Th>Last used</Th>
        <Th className="text-right">
          <span className="sr-only">Actions</span>
        </Th>
      </THead>
      <tbody>
        {keys.map((k) => {
          const status = getKeyStatus(k, now);
          const tone = status.variant === 'danger' ? 'text-crimson' : status.variant === 'pending' ? 'text-amber-600 dark:text-amber-400' : 'text-muted';
          return (
            <Tr key={k.id} className={k.revoked_at ? 'opacity-60' : undefined}>
              <Td className="font-semibold">{k.name}</Td>
              <Td className="font-mono text-xs text-muted">{k.prefix}_…</Td>
              <Td>
                <Chip variant={status.variant}>{status.label}</Chip>
              </Td>
              <Td className="text-muted whitespace-nowrap">{date(k.created_at)}</Td>
              <Td className="whitespace-nowrap" title={k.expires_at ? new Date(k.expires_at).toLocaleString() : 'This key never expires'}>
                <span className="text-ink-secondary">{formatExpiryDisplay(k.expires_at)}</span>
                {!k.revoked_at && <span className={`block text-xs tabular-nums ${tone}`}>{timeLeft(k.expires_at, now)}</span>}
              </Td>
              <Td className="text-muted whitespace-nowrap" title={k.last_used_at ? new Date(k.last_used_at).toLocaleString() : undefined}>
                {formatRelativeTime(k.last_used_at)}
              </Td>
              <Td className="text-right">
                {!k.revoked_at && (
                  <Button size="sm" variant="outline" onClick={() => onRevoke(k)} aria-label={`Revoke ${k.name}`}>
                    Revoke
                  </Button>
                )}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
