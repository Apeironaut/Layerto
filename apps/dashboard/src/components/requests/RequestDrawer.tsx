import type { RequestLogItem } from '@layerto/types';
import { CopyButton, Drawer, usd } from '@layerto/ui';
import { RequestStatusChip } from './RequestStatusChip';

export interface RequestDrawerProps {
  request: RequestLogItem | null;
  onClose: () => void;
}

/** Detail drawer showing all fields of a vision request with copy button. */
export function RequestDrawer({ request, onClose }: RequestDrawerProps) {
  if (!request) return null;

  return (
    <Drawer
      isOpen={!!request}
      onClose={onClose}
      title="Request details"
      description={`Sequence #${request.seq}`}
      footer={
        <CopyButton
          text={request.request_id}
          label="Copy Request ID"
          variant="primary"
          size="md"
        />
      }
    >
      <div className="space-y-5">
        <div>
          <label className="text-xs text-muted font-medium uppercase tracking-wider block mb-1">
            Request ID
          </label>
          <div className="flex items-center justify-between p-3 rounded-control bg-page border border-line gap-2">
            <span className="font-mono text-xs text-ink select-all break-all">{request.request_id}</span>
            <CopyButton text={request.request_id} label="Copy" size="sm" variant="ghost" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-control bg-page border border-line">
            <span className="text-xs text-muted block mb-1">Status</span>
            <RequestStatusChip status={request.status} />
          </div>
          <div className="p-3 rounded-control bg-page border border-line">
            <span className="text-xs text-muted block mb-1">Route</span>
            <span className="font-semibold text-sm capitalize">{request.routed}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-control bg-page border border-line">
            <span className="text-xs text-muted block mb-1">Model</span>
            <span className="font-mono text-xs font-bold text-ink">{request.model_slug}</span>
          </div>
          <div className="p-3 rounded-control bg-page border border-line">
            <span className="text-xs text-muted block mb-1">Latency</span>
            <span className="font-mono text-sm font-semibold">
              {request.latency_ms > 0 ? `${request.latency_ms} ms` : '—'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-control bg-page border border-line">
          <span className="text-xs text-muted block mb-1">Charge</span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-base font-bold text-ink">{usd(request.charge_usd)}</span>
            <span className="text-xs text-muted">({request.charge_micro_usd.toLocaleString()} µUSD)</span>
          </div>
        </div>

        <div className="p-3 rounded-control bg-page border border-line">
          <span className="text-xs text-muted block mb-1">Timestamp</span>
          <div className="text-sm font-medium">{new Date(request.created_at).toLocaleString()}</div>
          <div className="text-xs font-mono text-muted mt-0.5">{request.created_at}</div>
        </div>
      </div>
    </Drawer>
  );
}
