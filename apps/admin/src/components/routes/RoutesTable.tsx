import type { RouteItem } from '@layerto/types';
import { Button, Chip, Table, THead, Th, Tr, Td } from '@layerto/ui';

/** Routing rules, highest priority first. */
export function RoutesTable({ routes, onDelete }: { routes: RouteItem[]; onDelete: (route: RouteItem) => void }) {
  const sorted = [...routes].sort((a, b) => b.priority - a.priority || a.keyword.localeCompare(b.keyword));
  return (
    <Table label="Routing rules">
      <THead>
        <Th>Keyword</Th>
        <Th>Model</Th>
        <Th className="text-right">Priority</Th>
        <Th className="text-right">
          <span className="sr-only">Actions</span>
        </Th>
      </THead>
      <tbody>
        {sorted.map((r) => (
          <Tr key={r.id}>
            <Td className="font-semibold" lang="si-LK">
              {r.keyword}
            </Td>
            <Td>
              <div className="flex items-center gap-2">
                <span>{r.model_name}</span>
                {!r.model_enabled && <Chip variant="muted">Model disabled</Chip>}
              </div>
              <div className="font-mono text-xs text-muted">{r.model_slug}</div>
            </Td>
            <Td className="text-right tabular-nums">{r.priority}</Td>
            <Td className="text-right">
              <Button size="sm" variant="outline" onClick={() => onDelete(r)} aria-label={`Delete rule ${r.keyword}`}>
                Delete
              </Button>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
