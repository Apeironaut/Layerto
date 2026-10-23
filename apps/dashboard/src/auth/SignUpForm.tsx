import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SignupParams } from '@layerto/types';
import { errorCode, errorMessage } from '@layerto/api-client';
import { Alert, Button, Input, PasswordChecklist, PasswordInput, normalizeUsername, passwordValid } from '@layerto/ui';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { UsernameField } from './UsernameField';

export interface SignUpFormProps {
  onSignUp: (params: SignupParams) => Promise<void>;
}

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]{0,49}$/u;

function nameProblem(value: string, which: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return NAME_PATTERN.test(v) ? null : `${which} can only contain letters, spaces, hyphens, apostrophes and dots.`;
}

/** First/last name, unique username, email, strong password + confirmation. */
export function SignUpForm({ onSignUp }: SignUpFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [takenOnSubmit, setTakenOnSubmit] = useState<string | null>(null);

  const usernameState = useUsernameAvailability(username);
  const identity = { username: normalizeUsername(username), email: email.trim() };
  const firstProblem = nameProblem(firstName, 'First name');
  const lastProblem = nameProblem(lastName, 'Last name');
  const mismatch = confirm.length > 0 && confirm !== password;
  const usernameBlocked =
    usernameState.status === 'invalid' || usernameState.status === 'taken' || takenOnSubmit === normalizeUsername(username);

  const ready =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    !firstProblem &&
    !lastProblem &&
    username !== '' &&
    !usernameBlocked &&
    email.includes('@') &&
    passwordValid(password, identity) &&
    confirm === password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await onSignUp({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        username: normalizeUsername(username),
        email: email.trim(),
        password,
      });
    } catch (err) {
      if (errorCode(err) === 'username_taken') setTakenOnSubmit(normalizeUsername(username));
      setError(errorMessage(err, "Couldn't create the account. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="First name" autoComplete="given-name" maxLength={50} required value={firstName} onChange={(e) => setFirstName(e.target.value)} error={firstProblem} />
        <Input label="Last name" autoComplete="family-name" maxLength={50} required value={lastName} onChange={(e) => setLastName(e.target.value)} error={lastProblem} />
      </div>
      <UsernameField
        value={username}
        onChange={(v) => {
          setUsername(v);
          setTakenOnSubmit(null);
        }}
        state={takenOnSubmit === normalizeUsername(username) ? { status: 'taken', message: 'That username is taken.' } : usernameState}
      />
      <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <PasswordInput
        label="Password"
        autoComplete="new-password"
        required
        maxLength={128}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        below={<PasswordChecklist password={password} username={identity.username} email={identity.email} />}
      />
      <PasswordInput
        label="Confirm password"
        autoComplete="new-password"
        required
        maxLength={128}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={mismatch ? "Passwords don't match." : null}
        helperText={confirm.length > 0 && !mismatch ? 'Passwords match.' : undefined}
      />
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!ready}>
        Create account
      </Button>
      <p className="text-xs text-muted text-center">New accounts are approved by the Layerto team before they can make calls.</p>
    </form>
  );
}
