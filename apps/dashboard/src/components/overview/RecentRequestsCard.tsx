import { useState, useMemo } from 'react';
import type { RequestLogItem } from '@layerto/types';
import { Button, Card, EmptyState, Skeleton, SegmentedControl, Icon } from '@layerto/ui';
import { RequestsTable } from '../requests/RequestsTable';
import { useEndpointUsage } from '../../hooks/useEndpointUsage';
import { DonutChart } from './DonutChart';
import { calculatePieSlices, formatEndpointName } from '../../lib/chartCalculations';

const DAY_OPTIONS = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: '365', label: '1y' },
];

export interface RecentRequestsCardProps {
  requests: RequestLogItem[] | undefined;
  loading: boolean;
  onSelectRequest: (req: RequestLogItem) => void;
  onViewAll: () => void;
  onOpenPlayground: () => void;
}

export function RecentRequestsCard({
  requests,
  loading,
  onSelectRequest,
  onViewAll,
  onOpenPlayground,
}: RecentRequestsCardProps) {
  const [viewMode, setViewMode] = useState<'list' | 'endpoints'>('list');
  const [days, setDays] = useState('30');
  const daysNum = Number(days);

  const endpointUsage = useEndpointUsage(daysNum);
  const epData = endpointUsage.data;

  const recent = (requests ?? []).slice(0, 5);

  const pieSlices = useMemo(() => {
    if (!epData || !epData.by_endpoint) return [];
    const items = epData.by_endpoint.map((ep) => {
      const info = formatEndpointName(ep.endpoint);
      return {
        label: info.name,
        value: ep.requests,
      };
    });
    return calculatePieSlices(items);
  }, [epData]);

  const totalEndpointRequests = epData?.total_requests ?? 0;

  return (
    <Card
      title={viewMode === 'list' ? 'Recent requests' : `API Endpoints (${days} days)`}
      subtitle={
        viewMode === 'list'
          ? 'Latest 5 requests. Click to inspect payload.'
          : 'Request distribution across API entrypoints.'
      }
      className="h-full flex flex-col rounded-l1 bg-card border border-line shadow-l2 hover:shadow-l3 hover:-translate-y-1 transition-all duration-300 min-h-[460px]"
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === 'endpoints' && (
            <SegmentedControl
              label="Endpoint time range"
              segments={DAY_OPTIONS}
              value={days}
              onChange={setDays}
            />
          )}

          {/* Toggle between list and endpoint pie chart */}
          <div className="flex items-center p-0.5 rounded-control bg-page border border-line">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-sm transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-card text-ink shadow-xs' : 'text-muted hover:text-ink'
              }`}
              title="Table view of recent requests"
              aria-label="Table view"
            >
              <Icon name="list" size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('endpoints')}
              className={`p-1.5 rounded-sm transition-colors cursor-pointer ${
                viewMode === 'endpoints' ? 'bg-card text-crimson shadow-xs' : 'text-muted hover:text-ink'
              }`}
              title="Pie chart of API endpoints"
              aria-label="API endpoints chart view"
            >
              <Icon name="chart" size={15} />
            </button>
          </div>

          {recent.length > 0 && viewMode === 'list' && (
            <Button size="sm" variant="ghost" onClick={onViewAll}>
              View all
            </Button>
          )}
        </div>
      }
    >
      <div className="flex-1 flex flex-col justify-between">
        {viewMode === 'list' ? (
          <div>
            {loading ? (
              <Skeleton className="h-48" />
            ) : recent.length === 0 ? (
              <EmptyState
                icon="list"
                title="No requests yet"
                description="Run an image in the playground or call the API; requests show up here."
                action={
                  <Button size="sm" icon="spark" onClick={onOpenPlayground}>
                    Open the playground
                  </Button>
                }
              />
            ) : (
              <RequestsTable requests={recent} compact onSelect={onSelectRequest} />
            )}
          </div>
        ) : (
          <div className="py-2">
            {endpointUsage.loading ? (
              <div className="space-y-4">
                <Skeleton className="h-44 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : totalEndpointRequests === 0 ? (
              <EmptyState
                icon="cpu"
                title={`No API calls in the last ${days} days`}
                description="Inference requests via API or dashboard will appear here grouped by endpoint."
                action={
                  <Button size="sm" icon="spark" onClick={onOpenPlayground}>
                    Try playground
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                <DonutChart
                  slices={pieSlices}
                  totalLabel="API Calls"
                  totalValue={totalEndpointRequests.toLocaleString()}
                  valueFormatter={(v) => `${v.toLocaleString()} calls`}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer info note */}
        <div className="pt-4 mt-auto border-t border-line/60 flex items-center justify-between text-xs text-muted">
          <span>
            {viewMode === 'list'
              ? 'Click any row to view full request metadata'
              : `Tracking API usage across routes for the last ${days} days`}
          </span>
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'list' ? 'endpoints' : 'list'))}
            className="text-crimson font-medium hover:underline cursor-pointer"
          >
            {viewMode === 'list' ? 'Show endpoints pie chart →' : '← Back to recent requests'}
          </button>
        </div>
      </div>
    </Card>
  );
}
