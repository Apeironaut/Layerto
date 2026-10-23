import type { UserSummary } from '@layerto/types';
import { Button, Chip, Table, THead, Th, Tr, Td } from '@layerto/ui';
import { UserStatusChip } from './UserStatusChip';

export interface UsersTableProps {
  users: UserSummary[];
  busyId: string | null;
  onSelect?: (user: UserSummary) => void;
  onApprove: (user: UserSummary) => void;
  onSuspend: (user: UserSummary) => void;
  onCredit: (user: UserSummary) => void;
}

/** Accounts with the actions allowed for each status. Clicking a row opens detail drawer. */
export function UsersTable({ users, busyId, onSelect, onApprove, onSuspend, onCredit }: UsersTableProps) {
  return (
    <Table label="Users">
      <THead>
        <Th>Account</Th>
        <Th>Status</Th>
        <Th>Joined</Th>
        <Th className="text-right">
          <span className="sr-only">Actions</span>
        </Th>
      </THead>
      <tbody>
        {users.map((u) => {
          const busy = busyId === u.id;
          return (
            <Tr
              key={u.id}
              onClick={() => onSelect?.(u)}
              className={onSelect ? 'cursor-pointer hover:bg-page/80' : undefined}
            >
              <Td>
                <div className="font-semibold flex items-center gap-2">
                  {u.first_name ? `${u.first_name} ${u.last_name ?? ''}`.trim() : u.name || u.email}
                  {u.role === 'admin' && <Chip variant="brand">Admin</Chip>}
                </div>
                <div className="text-xs text-muted">
                  {u.username && <span className="font-mono">@{u.username} · </span>}
                  {u.email}
                </div>
              </Td>
              <Td>
                <UserStatusChip status={u.status} />
              </Td>
              <Td className="text-muted whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</Td>
              <Td>
                <div
                  className="flex justify-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {u.status !== 'active' && (
                    <Button size="sm" icon="check" loading={busy} onClick={() => onApprove(u)}>
                      {u.status === 'suspended' ? 'Reactivate' : 'Approve'}
                    </Button>
                  )}
                  {u.status === 'active' && (
                    <>
                      <Button size="sm" variant="secondary" icon="plus" onClick={() => onCredit(u)}>
                        Add credit
                      </Button>
                      {u.role !== 'admin' && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => onSuspend(u)}>
                          Suspend
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
