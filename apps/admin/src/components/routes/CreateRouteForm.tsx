import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AdminModelItem, RouteItem } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { Alert, Button, Card, Input, Select } from '@layerto/ui';
import { api } from '../../lib/api';

export interface CreateRouteFormProps {
  models: AdminModelItem[];
  onCreated: (route: RouteItem) => void;
}

/** Adds a keyword rule. Keywords can be English or Sinhala. */
export function CreateRouteForm({ models, onCreated }: CreateRouteFormProps) {
  const [keyword, setKeyword] = useState('');
  const [modelSlug, setModelSlug] = useState('');
  const [priority, setPriority] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slug = modelSlug || models[0]?.slug || '';
  const priorityValue = Number(priority);
  const priorityValid = Number.isInteger(priorityValue) && priorityValue >= 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !slug || !priorityValid) return;
    setBusy(true);
    setError(null);
    try {
      onCreated(await api.adminCreateRoute({ keyword: keyword.trim(), model_slug: slug, priority: priorityValue }));
      setKeyword('');
    } catch (err) {
      setError(errorMessage(err, "Couldn't add the rule. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Add a rule" subtitle="When a prompt contains the keyword, “auto” requests go to this model.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_1fr_auto] gap-3 items-end">
          <Input label="Keyword" placeholder="e.g. receipt or රිසිට්පත" required value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <Select
            label="Model"
            value={slug}
            onChange={(e) => setModelSlug(e.target.value)}
            options={models.map((m) => ({ value: m.slug, label: m.enabled ? m.name : `${m.name} (disabled)` }))}
          />
          <Input
            label="Priority"
            type="number"
            min={0}
            step={1}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            error={priorityValid ? null : 'Whole number, 0 or more.'}
          />
          <Button type="submit" icon="plus" loading={busy} disabled={!keyword.trim() || !slug || !priorityValid}>
            Add rule
          </Button>
        </div>
      </form>
    </Card>
  );
}
