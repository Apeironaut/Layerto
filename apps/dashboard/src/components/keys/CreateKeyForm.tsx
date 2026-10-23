import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CreatedApiKey } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { Alert, Button, Card, Input } from '@layerto/ui';
import { api } from '../../lib/api';
import { MAX_ACTIVE_KEYS } from '../../hooks/useKeys';
import { computeExpiryDate } from '../../lib/keyExpiry';
import type { ExpiryPreset } from '../../lib/keyExpiry';
import { ExpiryPicker, ExpirySummary } from './ExpiryPicker';

export interface CreateKeyFormProps {
  atLimit: boolean;
  onCreated: (key: CreatedApiKey) => void;
}

/**
 * Creates a key. The expiry is chosen here, before the key exists, and the server
 * stores it and refuses the key once that time has passed.
 */
export function CreateKeyForm({ atLimit, onCreated }: CreateKeyFormProps) {
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<ExpiryPreset>('90d');
  const [customDate, setCustomDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expiresAt = preset === 'custom' && !customDate ? undefined : computeExpiryDate(preset, customDate);
  const ready = name.trim() !== '' && !atLimit && expiresAt !== undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      // Recompute at submit time so a form left open doesn't send a stale date.
      onCreated(await api.createKey(name.trim(), computeExpiryDate(preset, customDate)));
      setName('');
    } catch (err) {
      setError(errorMessage(err, "Couldn't create the key. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Create an API key" subtitle="Name it after where you'll use it, and choose when it stops working.">
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 items-start">
        <Input label="Key name" placeholder="e.g. production-backend" maxLength={64} required value={name} onChange={(e) => setName(e.target.value)} />
        <ExpiryPicker preset={preset} customDate={customDate} onPresetChange={setPreset} onCustomDateChange={setCustomDate} />
        <div className="lg:pt-6">
          <Button type="submit" icon="key" loading={busy} disabled={!ready} className="w-full lg:w-auto">
            Create key
          </Button>
        </div>
      </form>

      <div className="mt-4">
        <ExpirySummary preset={preset} expiresAt={expiresAt} />
      </div>

      {atLimit && <p className="mt-3 text-sm text-crimson">You have {MAX_ACTIVE_KEYS} active keys, the maximum. Revoke one to create another.</p>}
    </Card>
  );
}
