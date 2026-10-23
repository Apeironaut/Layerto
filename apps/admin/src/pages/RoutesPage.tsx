import { useState } from 'react';
import type { RouteItem } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { Alert, Card, ConfirmModal, EmptyState, PageHeader, Reveal, Skeleton, useNotify } from '@layerto/ui';
import { CreateRouteForm } from '../components/routes/CreateRouteForm';
import { RoutesTable } from '../components/routes/RoutesTable';
import { useAdminModels } from '../hooks/useAdminModels';
import { useRoutes } from '../hooks/useRoutes';
import { api } from '../lib/api';

export function RoutesPage() {
  const routes = useRoutes();
  const models = useAdminModels();
  const notify = useNotify();
  const [deleting, setDeleting] = useState<RouteItem | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.adminDeleteRoute(deleting.id);
      notify(`Rule “${deleting.keyword}” deleted`, 'success');
      setDeleting(null);
      await routes.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't delete the rule. Try again."), 'error');
    } finally {
      setBusy(false);
    }
  };

  const list = routes.data ?? [];
  return (
    <>
      <PageHeader title="Routing" description="Requests to /v1/vision/auto pick a model by matching these keywords in the prompt. Higher priority wins." />
      <Reveal index={0}>
        <CreateRouteForm
          models={models.data ?? []}
          onCreated={(r) => {
            notify(`Rule “${r.keyword}” → ${r.model_name} added`, 'success');
            void routes.reload();
          }}
        />
      </Reveal>
      <Reveal index={1}>
        <Card title="Rules">
          {routes.error !== undefined && !routes.data ? (
            <Alert tone="error">{errorMessage(routes.error, "Couldn't load rules.")}</Alert>
          ) : routes.loading ? (
            <Skeleton className="h-32" />
          ) : list.length === 0 ? (
            <EmptyState icon="route" title="No rules yet" description="Without rules, auto requests can't pick a model." />
          ) : (
            <RoutesTable routes={list} onDelete={setDeleting} />
          )}
        </Card>
      </Reveal>
      <ConfirmModal
        isOpen={deleting !== null}
        title="Delete this rule?"
        description={
          <>
            Prompts containing <strong className="text-ink">{deleting?.keyword}</strong> will no longer route to {deleting?.model_name}.
          </>
        }
        confirmLabel="Delete rule"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
