import { useState } from 'react';
import type { AdminModelItem } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { Alert, Card, EmptyState, PageHeader, Reveal, Skeleton, useNotify, usd } from '@layerto/ui';
import { ModelsTable } from '../components/models/ModelsTable';
import { PriceModal } from '../components/models/PriceModal';
import { useAdminModels } from '../hooks/useAdminModels';
import { api } from '../lib/api';

export function ModelsPage() {
  const models = useAdminModels();
  const notify = useNotify();
  const [editing, setEditing] = useState<AdminModelItem | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const toggle = async (m: AdminModelItem) => {
    setBusySlug(m.slug);
    try {
      await api.adminUpdateModelStatus(m.slug, !m.enabled);
      notify(`${m.name} ${m.enabled ? 'disabled' : 'enabled'}`, 'success');
      await models.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't change the model. Try again."), 'error');
    } finally {
      setBusySlug(null);
    }
  };

  const list = models.data ?? [];
  return (
    <>
      <PageHeader title="Models" description="Prices are per successful call. Disabled models reject requests and are hidden from the catalogue." />
      <Reveal index={0}>
        <Card>
          {models.error !== undefined && !models.data ? (
            <Alert tone="error">{errorMessage(models.error, "Couldn't load models.")}</Alert>
          ) : models.loading ? (
            <Skeleton className="h-40" />
          ) : list.length === 0 ? (
            <EmptyState icon="cpu" title="No models" description="Models are added with database migrations." />
          ) : (
            <ModelsTable models={list} busySlug={busySlug} onEditPrice={setEditing} onToggle={(m) => void toggle(m)} />
          )}
        </Card>
      </Reveal>
      {editing && (
        <PriceModal
          model={editing}
          onClose={() => setEditing(null)}
          onSaved={(res) => {
            notify(`${res.name} now costs ${usd(res.new_price_usd)} per call`, 'success');
            setEditing(null);
            void models.reload();
          }}
        />
      )}
    </>
  );
}
