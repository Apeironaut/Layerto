import { useState } from 'react';
import type { UserSummary } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import {
  Alert,
  AnimatedNumber,
  Button,
  Card,
  Chip,
  EmptyState,
  PageHeader,
  Reveal,
  Skeleton,
  StatCard,
  Table,
  THead,
  Th,
  Tr,
  Td,
  useNotify,
  usd,
} from '@layerto/ui';
import { useAdminStats } from '../hooks/useAdminStats';
import { useUsers } from '../hooks/useUsers';
import { useAdminEvents } from '../hooks/useAdminEvents';
import { api } from '../lib/api';

export interface OverviewPageProps {
  navigate: (path: string) => void;
  onUserChanged: () => void;
}

export function OverviewPage({ navigate, onUserChanged }: OverviewPageProps) {
  const stats = useAdminStats();
  const pendingUsers = useUsers('pending');
  const recentEvents = useAdminEvents('all', 10);
  const notify = useNotify();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const s = stats.data;
  const pendingList = pendingUsers.data ?? [];
  const eventsList = (recentEvents.data ?? []).slice(0, 10);

  const approve = async (u: UserSummary) => {
    setApprovingId(u.id);
    try {
      await api.adminApproveUser(u.id);
      notify(`${u.email} approved`, 'success');
      onUserChanged();
      await pendingUsers.reload();
      await stats.reload();
      await recentEvents.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't approve the user."), 'error');
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Admin overview"
        description="Platform health, pending account approvals, and recent ledger activity."
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon="refresh"
            loading={stats.refreshing && !stats.loading}
            onClick={() => {
              void stats.reload();
              void pendingUsers.reload();
              void recentEvents.reload();
            }}
          >
            Refresh
          </Button>
        }
      />

      <Reveal index={0}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active users"
            loading={stats.loading}
            value={<AnimatedNumber value={s?.users.active ?? 0} />}
            hint={s ? `${s.users.pending} pending · ${s.users.suspended} suspended` : undefined}
          />
          <StatCard
            label="Requests (24h)"
            loading={stats.loading}
            value={<AnimatedNumber value={s?.requests_24h ?? 0} />}
            hint="Past 24 hours across all models"
          />
          <StatCard
            label="Revenue (30d)"
            loading={stats.loading}
            value={s ? usd(s.revenue_30d_usd) : '$0.00'}
            hint={s ? `${s.revenue_30d_micro_usd.toLocaleString()} µUSD` : undefined}
          />
          <StatCard
            label="Models & Routes"
            loading={stats.loading}
            value={
              <>
                <AnimatedNumber value={s?.models.enabled ?? 0} />
                <span className="text-base font-normal text-muted"> / {s ? s.models.enabled + s.models.disabled : 0}</span>
              </>
            }
            hint={s ? `${s.routes} active routes configured` : undefined}
          />
        </div>
      </Reveal>

      <Reveal index={1}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* Waiting for approval */}
          <Card
            title="Waiting for approval"
            subtitle={`${pendingList.length} ${pendingList.length === 1 ? 'account' : 'accounts'} awaiting review`}
            actions={
              pendingList.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => navigate('/users')}>
                  Manage all
                </Button>
              )
            }
          >
            {pendingUsers.error !== undefined && !pendingUsers.data ? (
              <Alert tone="error">{errorMessage(pendingUsers.error, "Couldn't load pending users.")}</Alert>
            ) : pendingUsers.loading ? (
              <Skeleton className="h-32" />
            ) : pendingList.length === 0 ? (
              <EmptyState
                icon="check"
                title="All caught up"
                description="No accounts are currently waiting for admin approval."
              />
            ) : (
              <Table label="Waiting for approval">
                <THead>
                  <Th>Account</Th>
                  <Th>Registered</Th>
                  <Th className="text-right">Action</Th>
                </THead>
                <tbody>
                  {pendingList.map((u) => (
                    <Tr key={u.id}>
                      <Td>
                        <div className="font-semibold text-sm">{u.email}</div>
                        {u.name && <div className="text-xs text-muted">{u.name}</div>}
                      </Td>
                      <Td className="text-muted whitespace-nowrap text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </Td>
                      <Td className="text-right">
                        <Button
                          size="sm"
                          icon="check"
                          loading={approvingId === u.id}
                          onClick={() => void approve(u)}
                        >
                          Approve
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {/* Recent activity */}
          <Card
            title="Recent activity"
            subtitle="Latest 10 cryptographic ledger events"
            actions={
              <Button size="sm" variant="ghost" onClick={() => navigate('/activity')}>
                View all
              </Button>
            }
          >
            {recentEvents.loading ? (
              <Skeleton className="h-32" />
            ) : eventsList.length === 0 ? (
              <EmptyState
                icon="shield"
                title="No events yet"
                description="Ledger events will appear here in real-time."
              />
            ) : (
              <Table label="Recent activity">
                <THead>
                  <Th>Seq</Th>
                  <Th>Event</Th>
                  <Th>User / Model</Th>
                  <Th className="text-right">Time</Th>
                </THead>
                <tbody>
                  {eventsList.map((ev) => (
                    <Tr key={ev.seq}>
                      <Td className="font-mono text-xs text-muted">#{ev.seq}</Td>
                      <Td>
                        <Chip variant="neutral">{ev.type}</Chip>
                      </Td>
                      <Td className="text-xs text-ink truncate max-w-[180px]">
                        {ev.user_email || ev.model_slug || (ev.request_id ? ev.request_id.slice(0, 8) + '…' : '—')}
                      </Td>
                      <Td className="text-right text-muted text-xs whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </Reveal>
    </>
  );
}
