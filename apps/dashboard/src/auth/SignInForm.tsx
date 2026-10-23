import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage } from '@layerto/api-client';
import { Alert, Button, Input, PasswordInput } from '@layerto/ui';
import { AdminNotAllowedError } from '../hooks/useSession';

export interface SignInFormProps {
  onSignIn: (login: string, password: string) => Promise<void>;
  onForgot: () => void;
}

/** Email-or-username + password. */
export function SignInForm({ onSignIn, onForgot }: SignInFormProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSignIn(login.trim(), password);
    } catch (err) {
      setError(err instanceof AdminNotAllowedError ? err.message : errorMessage(err, 'Incorrect email, username or password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Input
        label="Email or username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={login}
        onChange={(e) => setLogin(e.target.value)}
      />
      <div className="space-y-1.5">
        <PasswordInput label="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex justify-end">
          <button type="button" onClick={onForgot} className="text-xs font-semibold text-crimson hover:underline underline-offset-2 cursor-pointer">
            Forgot password?
          </button>
        </div>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Sign in
      </Button>
    </form>
  );
}
