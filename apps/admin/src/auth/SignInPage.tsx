import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '@layerto/api-client';
import { Alert, AuthLayout, Button, Input, PasswordInput } from '@layerto/ui';
import { NotAdminError } from '../hooks/useAdminSession';

export interface SignInPageProps {
  notice?: string;
  onSignIn: (email: string, password: string) => Promise<void>;
}

/** Admin sign-in. There is no sign-up here; admins are promoted in the database. */
export function SignInPage({ notice, onSignIn }: SignInPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSignIn(email, password);
    } catch (err) {
      setError(err instanceof NotAdminError ? err.message : errorMessage(err, 'Email or password is incorrect.'));
    } finally {
      setBusy(false);
    }
  };

  const shown = error ?? notice;
  return (
    <AuthLayout title="Admin sign in" subtitle="Approve accounts, add credit, set prices and routing.">
      <form onSubmit={submit} className="space-y-4">
        {shown && <Alert tone="error">{shown}</Alert>}
        <Input label="Email or username" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordInput label="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
