import { useState } from 'react';
import type { ApiKeyItem, CreatedApiKey } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { ApiKeyRevealModal, Card, ConfirmModal, EmptyState, PageHeader, Reveal, Skeleton, useNotify, useNow } from '@layerto/ui';
import { CreateKeyForm } from '../components/keys/CreateKeyForm';
import { KeysTable } from '../components/keys/KeysTable';
import { useKeys } from '../hooks/useKeys';
import { api } from '../lib/api';

export function KeysPage() {
  const now = useNow();
  const keys = useKeys(now);
  const notify = useNotify();
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [revoking, setRevoking] = useState<ApiKeyItem | null>(null);
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    try {
      await api.revokeKey(revoking.id);
      notify(`Key “${revoking.name}” revoked`, 'success');
      setRevoking(null);
      await keys.reload();
    } catch (err) {
      notify(errorMessage(err, "Couldn't revoke the key. Try again."), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="API keys" description={<>Send a key as <code>Authorization: Bearer lt_…</code>. Keys are stored hashed and shown once.</>} />
      <Reveal index={0}>
        <CreateKeyForm
          atLimit={keys.atLimit}
          onCreated={(k) => {
            setCreated(k);
            void keys.reload();
          }}
        />
      </Reveal>
      <Reveal index={1}>
        <Card title="Your keys">
          {keys.loading ? (
            <Skeleton className="h-32" />
          ) : (keys.data ?? []).length === 0 ? (
            <EmptyState icon="key" title="No keys yet" description="Create your first key above to call the API." />
          ) : (
            <KeysTable keys={keys.data ?? []} now={now} onRevoke={setRevoking} />
          )}
        </Card>
      </Reveal>

      {created && (
        <ApiKeyRevealModal
          isOpen
          apiKey={created.key}
          keyName={created.name}
          expiresAt={created.expires_at}
          onClose={() => {
            setCreated(null);
            notify(`Key “${created.name}” created`, 'success');
          }}
        />
      )}
      <ConfirmModal
        isOpen={revoking !== null}
        title="Revoke this key?"
        description={
          <>
            Apps using <strong className="text-ink">{revoking?.name}</strong> will start getting 401 errors right away. This can't be undone.
          </>
        }
        confirmLabel="Revoke key"
        danger
        busy={busy}
        onConfirm={revoke}
        onCancel={() => setRevoking(null)}
      />
    </>
  );
}
