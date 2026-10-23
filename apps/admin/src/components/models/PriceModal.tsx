import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AdminModelItem, UpdateModelPriceResponse } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { Alert, Button, Input, Modal } from '@layerto/ui';
import { api } from '../../lib/api';
import { formatMicro, parseUsdToMicro } from '../../lib/usdAmount';

export interface PriceModalProps {
  model: AdminModelItem;
  onClose: () => void;
  onSaved: (res: UpdateModelPriceResponse) => void;
}

/** Sets a model's per-call price. Applies to new requests only. */
export function PriceModal({ model, onClose, onSaved }: PriceModalProps) {
  const [price, setPrice] = useState(model.price_per_call_usd.replace(/^\$/, ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const micro = parseUsdToMicro(price);
  const unchanged = micro === model.price_per_call;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (micro === null || unchanged) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.adminUpdateModelPrice(model.slug, price.trim()));
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the price. Try again."));
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Price for ${model.name}`} description="New requests use the new price. Past charges don't change.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Input
          label="Price per call (USD)"
          inputMode="decimal"
          autoFocus
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          error={price.trim() !== '' && micro === null ? 'Enter a positive amount with up to 6 decimal places.' : null}
        />
        <div className="rounded-control border border-line bg-page px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted">Current</span>
            <span className="font-mono tabular-nums">{formatMicro(model.price_per_call)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">New</span>
            <span className="font-mono font-semibold tabular-nums">{micro === null ? '—' : formatMicro(micro)}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={micro === null || unchanged}>
            Save price
          </Button>
        </div>
      </form>
    </Modal>
  );
}
