import { useMemo, useState } from 'react';
import type { RequestLogItem } from '@layerto/types';
import { Button, Card, EmptyState, PageHeader, Reveal, Select, Skeleton } from '@layerto/ui';
import { RequestsTable } from '../components/requests/RequestsTable';
import { RequestDrawer } from '../components/requests/RequestDrawer';
import { useRequests } from '../hooks/useRequests';

export function RequestsPage({ navigate }: { navigate: (path: string) => void }) {
  const requests = useRequests();
  const list = requests.data ?? [];
  const [statusFilter, setStatusFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [selected, setSelected] = useState<RequestLogItem | null>(null);

  const modelOptions = useMemo(() => {
    const slugs = Array.from(new Set(list.map((r) => r.model_slug).filter(Boolean))).sort();
    return [{ value: 'all', label: 'All models' }, ...slugs.map((s) => ({ value: s, label: s }))];
  }, [list]);

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'executed', label: 'Executed' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
    { value: 'abandoned', label: 'Abandoned' },
  ];

  const filtered = useMemo(() => {
    return list.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (modelFilter !== 'all' && r.model_slug !== modelFilter) return false;
      return true;
    });
  }, [list, statusFilter, modelFilter]);

  return (
    <>
      <PageHeader
        title="Requests"
        description="Your vision request history. Click any row to inspect all fields."
        actions={
          <Button
            variant="secondary"
            icon="refresh"
            loading={requests.refreshing && !requests.loading}
            onClick={() => void requests.reload()}
          >
            Refresh
          </Button>
        }
      />

      <Reveal index={0}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="w-40 sm:w-48">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            />
          </div>
          <div className="w-44 sm:w-56">
            <Select
              options={modelOptions}
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              aria-label="Filter by model"
            />
          </div>
          {(statusFilter !== 'all' || modelFilter !== 'all') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setStatusFilter('all');
                setModelFilter('all');
              }}
            >
              Reset filters
            </Button>
          )}
        </div>

        <Card>
          {requests.loading ? (
            <Skeleton className="h-48" />
          ) : list.length === 0 ? (
            <EmptyState
              icon="list"
              title="No requests yet"
              description="Requests from the API and the playground appear here."
              action={
                <Button size="sm" icon="spark" onClick={() => navigate('/playground')}>
                  Open the playground
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="list"
              title="No matching requests"
              description="No requests match the selected filters."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStatusFilter('all');
                    setModelFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <RequestsTable requests={filtered} onSelect={setSelected} />
              {requests.hasMore && (
                <div className="pt-2 flex justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={requests.loadingMore}
                    onClick={() => void requests.loadMore()}
                  >
                    Load more requests
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </Reveal>

      <RequestDrawer request={selected} onClose={() => setSelected(null)} />
    </>
  );
}
