import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  PageHeader,
  Reveal,
  Select,
  Skeleton,
  Table,
  THead,
  Th,
  Tr,
  Td,
  useCopy,
  useNotify,
} from '@layerto/ui';
import { useAdminEvents } from '../hooks/useAdminEvents';

const EVENT_TYPES = [
  { value: 'all', label: 'All event types' },
  { value: 'user.signed_up', label: 'user.signed_up' },
  { value: 'user.approved', label: 'user.approved' },
  { value: 'user.suspended', label: 'user.suspended' },
  { value: 'credit.added', label: 'credit.added' },
  { value: 'key.created', label: 'key.created' },
  { value: 'key.revoked', label: 'key.revoked' },
  { value: 'request.received', label: 'request.received' },
  { value: 'request.executed', label: 'request.executed' },
  { value: 'request.failed', label: 'request.failed' },
  { value: 'route.created', label: 'route.created' },
  { value: 'route.deleted', label: 'route.deleted' },
  { value: 'model.price_updated', label: 'model.price_updated' },
  { value: 'model.status_updated', label: 'model.status_updated' },
];

function RequestIdPill({ id }: { id: string }) {
  const { copy } = useCopy();
  const notify = useNotify();

  return (
    <button
      type="button"
      onClick={async () => {
        if (await copy(id)) notify('Request ID copied', 'success');
      }}
      className="font-mono text-xs px-2 py-0.5 rounded-[6px] bg-page border border-line hover:border-crimson cursor-copy transition-colors"
      title={`Copy ${id}`}
      aria-label={`Copy request ID ${id}`}
    >
      {id.slice(0, 8)}…
    </button>
  );
}

export function ActivityPage() {
  const [selectedType, setSelectedType] = useState('all');
  const events = useAdminEvents(selectedType, 50);

  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    events.setTypeFilter(newType);
  };

  const list = events.data ?? [];

  // Deduplicate and gather distinct event types for dynamic selector if needed
  const availableTypes = useMemo(() => {
    return EVENT_TYPES;
  }, []);

  return (
    <>
      <PageHeader
        title="Activity"
        description="Immutable cryptographic audit trail of all ledger events."
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon="refresh"
            loading={events.refreshing && !events.loading}
            onClick={() => void events.reload()}
          >
            Refresh
          </Button>
        }
      />

      <Reveal index={0}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="w-56 sm:w-64">
            <Select
              options={availableTypes}
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value)}
              aria-label="Filter events by type"
            />
          </div>
          {selectedType !== 'all' && (
            <Button size="sm" variant="ghost" onClick={() => handleTypeChange('all')}>
              Reset filter
            </Button>
          )}
        </div>

        <Card>
          {events.loading ? (
            <Skeleton className="h-48" />
          ) : list.length === 0 ? (
            <EmptyState
              icon="shield"
              title="No events found"
              description={selectedType === 'all' ? 'No ledger events recorded yet.' : `No events of type "${selectedType}".`}
              action={
                selectedType !== 'all' ? (
                  <Button size="sm" variant="outline" onClick={() => handleTypeChange('all')}>
                    Show all events
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              <Table label="Ledger activity">
                <THead>
                  <Th>Seq</Th>
                  <Th>Event Type</Th>
                  <Th>User</Th>
                  <Th>Model</Th>
                  <Th>Request ID</Th>
                  <Th className="text-right">Timestamp</Th>
                </THead>
                <tbody>
                  {list.map((ev) => (
                    <Tr key={ev.seq}>
                      <Td className="font-mono text-xs text-muted">#{ev.seq}</Td>
                      <Td>
                        <Chip variant="neutral">{ev.type}</Chip>
                      </Td>
                      <Td className="text-xs text-ink">{ev.user_email || '—'}</Td>
                      <Td className="font-mono text-xs text-ink">{ev.model_slug || '—'}</Td>
                      <Td>{ev.request_id ? <RequestIdPill id={ev.request_id} /> : <span className="text-muted text-xs">—</span>}</Td>
                      <Td className="text-right text-muted whitespace-nowrap text-xs">
                        {new Date(ev.created_at).toLocaleString()}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>

              {events.hasMore && (
                <div className="pt-2 flex justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={events.loadingMore}
                    onClick={() => void events.loadMore()}
                  >
                    Load more events
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </Reveal>
    </>
  );
}
