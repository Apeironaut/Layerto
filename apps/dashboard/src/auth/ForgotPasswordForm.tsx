import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '@layerto/api-client';
import { Alert, Button, Icon, Input } from '@layerto/ui';
import { api } from '../lib/api';

/** Asks for an email and sends a reset link. The answer never reveals whether the account exists. */
export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError(errorMessage(err, "Couldn't send the link. Try again."));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-crimson-tint text-crimson">
          <Icon name="mail" size={26} />
        </div>
        <div>
          <p className="font-semibold">Check your email</p>
          <p className="mt-1 text-sm text-ink-secondary">
            If an account exists for <strong className="text-ink">{sentTo}</strong>, we've sent a link to reset the password. It works once and
            expires in 30 minutes.
          </p>
        </div>
        <Button variant="secondary" className="w-full" onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" size="lg" className="w-full" icon="mail" loading={busy} disabled={!email.includes('@')}>
        Send reset link
      </Button>
      <button type="button" onClick={onBack} className="w-full text-sm font-semibold text-crimson hover:underline underline-offset-2 cursor-pointer">
        Back to sign in
      </button>
    </form>
  );
}
