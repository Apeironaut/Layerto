import type { AdminModelItem } from '@layerto/types';
import { Button, Chip, Table, THead, Th, Tr, Td } from '@layerto/ui';
import { formatMicro } from '../../lib/usdAmount';

export interface ModelsTableProps {
  models: AdminModelItem[];
  busySlug: string | null;
  onEditPrice: (model: AdminModelItem) => void;
  onToggle: (model: AdminModelItem) => void;
}

/** Every model with price and availability controls. */
export function ModelsTable({ models, busySlug, onEditPrice, onToggle }: ModelsTableProps) {
  return (
    <Table label="Models">
      <THead>
        <Th>Model</Th>
        <Th>Type</Th>
        <Th className="text-right">Price / call</Th>
        <Th>Status</Th>
        <Th className="text-right">
          <span className="sr-only">Actions</span>
        </Th>
      </THead>
      <tbody>
        {models.map((m) => (
          <Tr key={m.slug} className={m.enabled ? undefined : 'opacity-70'}>
            <Td>
              <div className="font-semibold">{m.name}</div>
              <div className="font-mono text-xs text-muted">{m.slug}</div>
            </Td>
            <Td>
              <Chip variant={m.is_open ? 'neutral' : 'brand'}>{m.is_open ? 'Open' : 'Layerto'}</Chip>
            </Td>
            <Td className="text-right font-mono tabular-nums">{formatMicro(m.price_per_call)}</Td>
            <Td>{m.enabled ? <Chip variant="active">Enabled</Chip> : <Chip variant="muted">Disabled</Chip>}</Td>
            <Td>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => onEditPrice(m)}>
                  Edit price
                </Button>
                <Button size="sm" variant="outline" loading={busySlug === m.slug} onClick={() => onToggle(m)}>
                  {m.enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
