import { useMemo, useState } from 'react';
import type { UserSummary } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import {
  Alert,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  Input,
  PageHeader,
  Reveal,
  SegmentedControl,
  Skeleton,
  useNotify,
  usd,
} from '@layerto/ui';
import { CreditModal } from '../components/users/CreditModal';
import { UsersTable } from '../components/users/UsersTable';
import { UserDetailDrawer } from '../components/users/UserDetailDrawer';
import type { UserFilter } from '../hooks/useUsers';
import { useUsers } from '../hooks/useUsers';
import { api } from '../lib/api';

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'all', label: 'All' },
];

const EMPTY: Record<UserFilter, string> = {
  pending: 'No accounts are waiting for approval.',
  active: 'No active accounts yet.',
  suspended: 'No suspended accounts.',
  all: 'No accounts yet.',
};

export interface UsersPageProps {
  filter: UserFilter;
  onFilter: (f: UserFilter) => void;
  /** Called after an account's status changes (e.g. to refresh the pending badge). */
  onChanged: () => void;
}

export function UsersPage({ filter, onFilter, onChanged }: UsersPageProps) {
  const users = useUsers(filter);
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [suspending, setSuspending] = useState<UserSummary | null>(null);
  const [crediting, setCrediting] = useState<UserSummary | null>(null);

  const act = async (user: UserSummary, action: 'approve' | 'suspend') => {
    setBusyId(user.id);
    try {
      if (action === 'approve') await api.adminApproveUser(user.id);
      else await api.adminSuspendUser(user.id);
      notify(action === 'approve' ? `${user.email} can now use Layerto` : `${user.email} suspended`, 'success');
      setSuspending(null);
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...user, status: action === 'approve' ? 'active' : 'suspended' });
      }
      onChanged();
      await users.reload();
    } catch (err) {
      notify(errorMessage(err, 'That change failed. Try again.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const list = users.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => [u.email, u.username, u.first_name, u.last_name, u.name].some((v) => v?.toLowerCase().includes(q)));
  }, [list, search]);

  return (
    <>
      <PageHeader
        title="Users"
        description="Approve new accounts, add prepaid credit, inspect account details, suspend misuse."
        actions={<SegmentedControl label="Filter by status" segments={FILTERS} value={filter} onChange={onFilter} />}
      />

      <Reveal index={0}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              type="search"
              placeholder="Search by name, username or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users by email"
            />
          </div>
          {search && (
            <div className="text-xs text-muted">
              Showing {filtered.length} of {list.length} accounts
            </div>
          )}
        </div>

        <Card
          actions={
            <Button
              size="sm"
              variant="ghost"
              icon="refresh"
              loading={users.refreshing && !users.loading}
              onClick={() => void users.reload()}
            >
              Refresh
            </Button>
          }
          title={users.loading ? 'Accounts' : `${filtered.length} ${filtered.length === 1 ? 'account' : 'accounts'}`}
        >
          {users.error !== undefined && !users.data ? (
            <Alert tone="error">{errorMessage(users.error, "Couldn't load users.")}</Alert>
          ) : users.loading ? (
            <Skeleton className="h-40" />
          ) : list.length === 0 ? (
            <EmptyState icon="users" title="Nothing here" description={EMPTY[filter]} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="users"
              title="No matching users"
              description={`No users found matching "${search}".`}
              action={
                <Button size="sm" variant="outline" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <UsersTable
              users={filtered}
              busyId={busyId}
              onSelect={setSelectedUser}
              onApprove={(u) => void act(u, 'approve')}
              onSuspend={setSuspending}
              onCredit={setCrediting}
            />
          )}
        </Card>
      </Reveal>

      <UserDetailDrawer
        user={selectedUser}
        busyId={busyId}
        onClose={() => setSelectedUser(null)}
        onApprove={(u) => void act(u, 'approve')}
        onSuspend={setSuspending}
        onCredit={setCrediting}
      />

      <ConfirmModal
        isOpen={suspending !== null}
        title="Suspend this account?"
        description={
          <>
            <strong className="text-ink">{suspending?.email}</strong> will be signed out and their API keys will stop working until you reactivate them.
          </>
        }
        confirmLabel="Suspend"
        danger
        busy={busyId !== null}
        onConfirm={() => suspending && act(suspending, 'suspend')}
        onCancel={() => setSuspending(null)}
      />

      {crediting && (
        <CreditModal
          user={crediting}
          onClose={() => setCrediting(null)}
          onCredited={(res) => {
            notify(`Added ${usd(res.amount_usd)} · new balance ${usd(res.new_balance_usd)}`, 'success');
            setCrediting(null);
            void users.reload();
          }}
        />
      )}
    </>
  );
}
