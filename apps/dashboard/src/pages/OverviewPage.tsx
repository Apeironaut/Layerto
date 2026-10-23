import { useState } from 'react';
import type { BalanceResponse, RequestLogItem, User } from '@layerto/types';
import { Alert, Button, PageHeader, Reveal, isKeyExpiringSoon } from '@layerto/ui';
import { BalanceStats } from '../components/overview/BalanceStats';
import { GettingStartedChecklist } from '../components/overview/GettingStartedChecklist';
import { RecentRequestsCard } from '../components/overview/RecentRequestsCard';
import { TopModels } from '../components/overview/TopModels';
import { RequestDrawer } from '../components/requests/RequestDrawer';
import { useKeys } from '../hooks/useKeys';
import { useRequests } from '../hooks/useRequests';
import { useMonthUsage } from '../hooks/useMonthUsage';

export interface OverviewPageProps {
  user: User;
  balance: BalanceResponse | undefined;
  balanceLoading: boolean;
  navigate: (path: string) => void;
}

export function OverviewPage({ user, balance, balanceLoading, navigate }: OverviewPageProps) {
  const keys = useKeys();
  const requests = useRequests();
  const monthUsage = useMonthUsage();
  const [selectedRequest, setSelectedRequest] = useState<RequestLogItem | null>(null);

  const firstName = user.name?.trim().split(/\s+/)[0];

  const accountApproved = user.status === 'active';
  const hasApiKey = Boolean(keys.data && keys.data.length > 0);
  const hasSuccessfulCall = Boolean(requests.data && requests.data.some((r) => r.status === 'executed'));

  const expiringKeys = (keys.data ?? []).filter((k) => !k.revoked_at && isKeyExpiringSoon(k.expires_at));

  const mData = monthUsage.data;

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Overview'}
        description="Your balance, keys and recent activity."
      />

      {expiringKeys.length > 0 && (
        <Reveal index={0}>
          <Alert tone="info" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span>The following API {expiringKeys.length === 1 ? 'key expires' : 'keys expire'} within 7 days: </span>
              <strong className="text-ink">{expiringKeys.map((k) => k.name).join(', ')}</strong>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/keys')} className="shrink-0">
              Keys
            </Button>
          </Alert>
        </Reveal>
      )}

      <Reveal index={0}>
        <BalanceStats
          balance={balance}
          balanceLoading={balanceLoading}
          callsThisMonth={mData?.total_requests}
          spendThisMonth={mData?.total_charge_usd}
          usageLoading={monthUsage.loading}
        />
      </Reveal>

      <Reveal index={1}>
        <GettingStartedChecklist
          accountApproved={accountApproved}
          hasApiKey={hasApiKey}
          hasSuccessfulCall={hasSuccessfulCall}
          onCreateKey={() => navigate('/keys')}
          onOpenPlayground={() => navigate('/playground')}
        />
      </Reveal>

      {/* Side-by-side cards with matching height and 3-D shadow elevation */}
      <Reveal index={2}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          <RecentRequestsCard
            requests={requests.data}
            loading={requests.loading}
            onSelectRequest={setSelectedRequest}
            onViewAll={() => navigate('/requests')}
            onOpenPlayground={() => navigate('/playground')}
          />

          <TopModels />
        </div>
      </Reveal>

      <RequestDrawer request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </>
  );
}
