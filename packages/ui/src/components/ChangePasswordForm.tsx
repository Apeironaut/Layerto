import { useState } from 'react';
import type { FormEvent } from 'react';
import { passwordValid } from '../lib/passwordPolicy';
import { Alert } from './Alert';
import { Button } from './Button';
import { PasswordChecklist } from './PasswordChecklist';
import { PasswordInput } from './PasswordInput';

export interface ChangePasswordFormProps {
  username?: string;
  email?: string;
  /** Throw to show an error; resolve on success. */
  onSubmit: (current: string, next: string) => Promise<void>;
  /** Turns an error into a message. */
  describeError: (err: unknown) => string;
  onChanged?: () => void;
}

/** Current password + new password (with rules) + confirmation. */
export function ChangePasswordForm({ username, email, onSubmit, describeError, onChanged }: ChangePasswordFormProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current.length > 0 && passwordValid(next, { username, email }) && confirm === next && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
      onChanged?.();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-w-lg">
      {error && <Alert tone="error">{error}</Alert>}
      {done && <Alert tone="success">Password changed. Other devices have been signed out.</Alert>}
      <PasswordInput label="Current password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      <PasswordInput
        label="New password"
        autoComplete="new-password"
        required
        value={next}
        onChange={(e) => {
          setNext(e.target.value);
          setDone(false);
        }}
        below={next.length > 0 && <PasswordChecklist password={next} username={username} email={email} />}
      />
      <PasswordInput
        label="Confirm new password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={mismatch ? "Passwords don't match." : null}
      />
      <Button type="submit" icon="lock" loading={busy} disabled={!canSubmit}>
        Change password
      </Button>
    </form>
  );
}
