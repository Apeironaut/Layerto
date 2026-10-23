import type { UserSummary } from '@layerto/types';
import { Button, Chip, Drawer, Skeleton, usd } from '@layerto/ui';
import { useAdminUserDetail } from '../../hooks/useAdminUserDetail';
import { UserStatusChip } from './UserStatusChip';
import { UserKeysList } from './UserKeysList';
import { UserStudioSection } from './UserStudioSection';

export interface UserDetailDrawerProps {
  user: UserSummary | null;
  busyId: string | null;
  onClose: () => void;
  onApprove: (user: UserSummary) => void;
  onSuspend: (user: UserSummary) => void;
  onCredit: (user: UserSummary) => void;
}

/** Detail drawer displaying full user stats from /admin/users/{id} with moderation actions. */
export function UserDetailDrawer({
  user,
  busyId,
  onClose,
  onApprove,
  onSuspend,
  onCredit,
}: UserDetailDrawerProps) {
  const detailResource = useAdminUserDetail(user?.id ?? null);
  const detail = detailResource.data;
  const busy = busyId === user?.id;

  if (!user) return null;

  return (
    <Drawer
      isOpen={!!user}
      onClose={onClose}
      title={user.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : user.email}
      description={[user.username ? `@${user.username}` : null, user.email, `ID ${user.id.slice(0, 8)}…`].filter(Boolean).join(' · ')}
      footer={
        <div className="flex items-center gap-2">
          {user.status !== 'active' && (
            <Button
              size="sm"
              icon="check"
              loading={busy}
              onClick={() => {
                onApprove(user);
              }}
            >
              {user.status === 'suspended' ? 'Reactivate account' : 'Approve account'}
            </Button>
          )}
          {user.status === 'active' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                icon="plus"
                onClick={() => {
                  onCredit(user);
                }}
              >
                Add credit
              </Button>
              {user.role !== 'admin' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    onSuspend(user);
                  }}
                >
                  Suspend
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-control bg-page border border-line">
            <span className="text-xs text-muted block mb-1">Status</span>
            <UserStatusChip status={user.status} />
          </div>
          <div className="p-3 rounded-control bg-page border border-line">
            <span className="text-xs text-muted block mb-1">Role</span>
            <Chip variant={user.role === 'admin' ? 'brand' : 'neutral'}>{user.role}</Chip>
          </div>
        </div>

        {detailResource.loading && !detail ? (
          <div className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : detail ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-control bg-page border border-line">
                <span className="text-xs text-muted block mb-1">Prepaid balance</span>
                <span className="font-mono text-base font-bold text-ink">{usd(detail.balance_usd)}</span>
              </div>
              <div className="p-3 rounded-control bg-page border border-line">
                <span className="text-xs text-muted block mb-1">Free calls used</span>
                <span className="font-mono text-base font-semibold">{detail.free_calls_used}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-control bg-page border border-line">
                <span className="text-xs text-muted block mb-1">Active API keys</span>
                <span className="font-mono text-base font-semibold">{detail.active_keys}</span>
              </div>
              <div className="p-3 rounded-control bg-page border border-line">
                <span className="text-xs text-muted block mb-1">Requests (30 days)</span>
                <span className="font-mono text-base font-semibold">{detail.requests_30d.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 rounded-control bg-page border border-line">
              <span className="text-xs text-muted block mb-1">Spend (30 days)</span>
              <span className="font-mono text-base font-bold text-ink">{usd(detail.spend_30d_usd)}</span>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">API keys ({(detail.keys ?? []).length})</h3>
              <UserKeysList keys={detail.keys ?? []} />
            </section>

            <UserStudioSection userId={user.id} />
          </>
        ) : null}

        <div className="p-3 rounded-control bg-page border border-line">
          <span className="text-xs text-muted block mb-1">Registered</span>
          <div className="text-sm font-medium">{new Date(user.created_at).toLocaleString()}</div>
          <div className="text-xs font-mono text-muted mt-0.5">{user.created_at}</div>
        </div>
      </div>
    </Drawer>
  );
}
