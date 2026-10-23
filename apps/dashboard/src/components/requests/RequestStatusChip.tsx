import { Chip } from '@layerto/ui';
import type { ChipVariant } from '@layerto/ui';
import type { RequestLogItem } from '@layerto/types';

const VARIANT: Record<RequestLogItem['status'], ChipVariant> = {
  executed: 'active',
  pending: 'pending',
  failed: 'danger',
  abandoned: 'muted',
};

const LABEL: Record<RequestLogItem['status'], string> = {
  executed: 'Done',
  pending: 'Running',
  failed: 'Failed',
  abandoned: 'Abandoned',
};

export function RequestStatusChip({ status }: { status: RequestLogItem['status'] }) {
  return <Chip variant={VARIANT[status]}>{LABEL[status]}</Chip>;
}
