import type { RequestLogItem } from '@layerto/types';
import { Table, THead, Th, Tr, Td, usd, useCopy, useNotify } from '@layerto/ui';
import { RequestStatusChip } from './RequestStatusChip';

function RequestIdCell({ id }: { id: string }) {
  const { copy } = useCopy();
  const notify = useNotify();
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        if (await copy(id)) notify('Request ID copied', 'success');
      }}
      className="font-mono text-xs px-2 py-1 rounded-[8px] bg-page border border-line hover:border-crimson cursor-copy transition-colors"
      title={`Copy ${id}`}
      aria-label={`Copy request ID ${id}`}
    >
      {id.slice(0, 8)}…
    </button>
  );
}

/** Request log rows: when, model, route, status, latency, charge. */
export function RequestsTable({
  requests,
  compact = false,
  onSelect,
}: {
  requests: RequestLogItem[];
  compact?: boolean;
  onSelect?: (req: RequestLogItem) => void;
}) {
  return (
    <Table label="Requests">
      <THead>
        {!compact && <Th>Request</Th>}
        <Th>Time</Th>
        <Th>Model</Th>
        {!compact && <Th>Route</Th>}
        <Th>Status</Th>
        {!compact && <Th className="text-right">Latency</Th>}
        <Th className="text-right">Charge</Th>
      </THead>
      <tbody>
        {requests.map((r) => (
          <Tr
            key={r.request_id}
            onClick={() => onSelect?.(r)}
            className={onSelect ? 'cursor-pointer hover:bg-page/80' : undefined}
          >
            {!compact && (
              <Td>
                <RequestIdCell id={r.request_id} />
              </Td>
            )}
            <Td className="text-muted whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</Td>
            <Td className="font-mono text-xs font-semibold">{r.model_slug}</Td>
            {!compact && <Td className="text-muted capitalize">{r.routed}</Td>}
            <Td>
              <RequestStatusChip status={r.status} />
            </Td>
            {!compact && <Td className="text-right font-mono text-xs text-muted">{r.latency_ms > 0 ? `${r.latency_ms} ms` : '—'}</Td>}
            <Td className="text-right font-mono text-xs">{usd(r.charge_usd)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
