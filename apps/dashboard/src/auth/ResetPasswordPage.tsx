import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorCode, errorMessage } from '@layerto/api-client';
import { Alert, AuthLayout, Button, Icon, PasswordChecklist, PasswordInput, passwordValid } from '@layerto/ui';
import { api } from '../lib/api';

/** Reads the one-time token from ?token=… once, then removes it from the address bar. */
function takeToken(): string {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? '';
  if (token) window.history.replaceState(null, '', '/reset-password');
  return token;
}

export function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const [token] = useState(takeToken);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(!token);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = passwordValid(password) && confirm === password && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      if (errorCode(err) === 'invalid_reset_token') setExpired(true);
      else setError(errorMessage(err, "Couldn't reset the password. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title={done ? 'Password changed' : 'Choose a new password'} subtitle={done ? undefined : 'You’ll be signed out everywhere else.'}>
      {done ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <Icon name="check" size={26} />
          </div>
          <p className="text-sm text-ink-secondary">Your password has been changed. Sign in with the new one.</p>
          <Button className="w-full" size="lg" onClick={onDone}>
            Go to sign in
          </Button>
        </div>
      ) : expired ? (
        <div className="space-y-4">
          <Alert tone="error">This reset link is invalid or has expired. Links work once and expire after 30 minutes.</Alert>
          <Button className="w-full" variant="secondary" onClick={onDone}>
            Request a new link
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            below={<PasswordChecklist password={password} />}
          />
          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch ? "Passwords don't match." : null}
          />
          <Button type="submit" size="lg" className="w-full" icon="lock" loading={busy} disabled={!ready}>
            Change password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
