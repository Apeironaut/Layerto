import { Chip } from '@layerto/ui';

const VARIANT = { active: 'active', pending: 'pending', suspended: 'danger' } as const;
const LABEL: Record<string, string> = { active: 'Active', pending: 'Pending', suspended: 'Suspended' };

/** Account status as a chip (shape + colour, never colour alone). */
export function UserStatusChip({ status }: { status: string }) {
  const variant = VARIANT[status as keyof typeof VARIANT] ?? 'muted';
  return <Chip variant={variant}>{LABEL[status] ?? status}</Chip>;
}
