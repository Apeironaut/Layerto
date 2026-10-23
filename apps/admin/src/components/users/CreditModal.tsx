import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CreditResponse, UserSummary } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { Alert, Button, Input, Modal } from '@layerto/ui';
import { api } from '../../lib/api';
import { formatMicro, parseUsdToMicro } from '../../lib/usdAmount';

export interface CreditModalProps {
  user: UserSummary;
  onClose: () => void;
  onCredited: (res: CreditResponse) => void;
}

/** Adds prepaid credit; shows the exact amount that will be booked before sending. */
export function CreditModal({ user, onClose, onCredited }: CreditModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const micro = parseUsdToMicro(amount);
  const invalid = amount.trim() !== '' && micro === null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (micro === null) return;
    setBusy(true);
    setError(null);
    try {
      onCredited(await api.adminCreditUser(user.id, amount.trim(), note.trim() || undefined));
    } catch (err) {
      setError(errorMessage(err, "Couldn't add the credit. Try again."));
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Add credit" description={<>Prepaid credit for <strong className="text-ink">{user.email}</strong>.</>}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Input
          label="Amount (USD)"
          inputMode="decimal"
          placeholder="10.00"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={invalid ? 'Enter a positive amount with up to 6 decimal places.' : null}
        />
        <Input label="Note (optional)" placeholder="e.g. Bank transfer 21 Oct" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="rounded-control border border-line bg-page px-4 py-3 text-sm flex justify-between">
          <span className="text-muted">Will be credited</span>
          <span className="font-mono font-semibold tabular-nums">{micro === null ? '—' : `+${formatMicro(micro)}`}</span>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={micro === null}>
            Add credit
          </Button>
        </div>
      </form>
    </Modal>
  );
}
