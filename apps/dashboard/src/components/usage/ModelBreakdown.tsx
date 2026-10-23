import type { UsageResponse } from '@layerto/types';
import { EmptyState, Table, THead, Th, Tr, Td, usd } from '@layerto/ui';

/** Requests and spend per model, with each model's share of requests. */
export function ModelBreakdown({ usage }: { usage: UsageResponse }) {
  if (usage.by_model.length === 0) {
    return <EmptyState icon="chart" title="No calls in this period" description="Successful calls will show up here, split by model." />;
  }
  return (
    <Table label="Usage by model">
      <THead>
        <Th>Model</Th>
        <Th className="text-right">Requests</Th>
        <Th className="text-right">Spend</Th>
        <Th>Share</Th>
      </THead>
      <tbody>
        {usage.by_model.map((m) => {
          const pct = usage.total_requests > 0 ? Math.round((m.requests / usage.total_requests) * 100) : 0;
          return (
            <Tr key={m.model_slug}>
              <Td className="font-mono text-xs font-semibold">{m.model_slug}</Td>
              <Td className="text-right tabular-nums">{m.requests.toLocaleString()}</Td>
              <Td className="text-right font-mono text-xs">{usd(m.charge_usd)}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-line overflow-hidden" aria-hidden="true">
                    <div className="h-full bg-crimson rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted tabular-nums">{pct}%</span>
                </div>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
