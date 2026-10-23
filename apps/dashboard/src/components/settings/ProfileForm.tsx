import { useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '@layerto/types';
import { errorMessage } from '@layerto/api-client';
import { Alert, Button, Input, USERNAME_HINT, normalizeUsername, usernameProblem } from '@layerto/ui';
import { api } from '../../lib/api';

export interface ProfileFormProps {
  user: User;
  onSaved: (user: User) => void;
}

/** First and last name (always editable) and a username (set once, for older accounts). */
export function ProfileForm({ user, onSaved }: ProfileFormProps) {
  const [first, setFirst] = useState(user.first_name ?? '');
  const [last, setLast] = useState(user.last_name ?? '');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const needsUsername = !user.username;
  const usernameError = needsUsername && username ? usernameProblem(username) : null;
  const changed = first.trim() !== (user.first_name ?? '') || last.trim() !== (user.last_name ?? '') || (needsUsername && username !== '');
  const ready = first.trim() !== '' && last.trim() !== '' && changed && !usernameError && (!needsUsername || username !== '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateProfile({
        first_name: first.trim(),
        last_name: last.trim(),
        ...(needsUsername ? { username: normalizeUsername(username) } : {}),
      });
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save your profile."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {saved && !changed && <Alert tone="success">Profile saved.</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="First name" autoComplete="given-name" maxLength={50} value={first} onChange={(e) => { setFirst(e.target.value); setSaved(false); }} />
        <Input label="Last name" autoComplete="family-name" maxLength={50} value={last} onChange={(e) => { setLast(e.target.value); setSaved(false); }} />
      </div>
      {needsUsername ? (
        <Input
          label="Username"
          autoCapitalize="none"
          maxLength={30}
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          error={usernameError}
          helperText={`Choose once; it can't be changed later. ${USERNAME_HINT}`}
        />
      ) : (
        <Input label="Username" value={`@${user.username}`} readOnly disabled helperText="Usernames can't be changed." />
      )}
      <Input label="Email" value={user.email} readOnly disabled helperText="Contact support to change your email." />
      <Button type="submit" icon="check" loading={busy} disabled={!ready}>
        Save profile
      </Button>
    </form>
  );
}
