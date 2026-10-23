import { useEffect, useState } from 'react';
import { normalizeUsername, usernameProblem } from '@layerto/ui';
import { api } from '../lib/api';

export type UsernameState =
  | { status: 'idle' }
  | { status: 'invalid'; message: string }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken'; message: string }
  | { status: 'unknown' };

/** Checks a username's shape at once, then asks the server if it's free (debounced). */
export function useUsernameAvailability(value: string): UsernameState {
  const username = normalizeUsername(value);
  const problem = username ? usernameProblem(username) : null;
  const [remote, setRemote] = useState<{ username: string; state: UsernameState }>({ username: '', state: { status: 'idle' } });

  useEffect(() => {
    if (!username || problem) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api
        .usernameAvailable(username)
        .then((res) => {
          if (cancelled) return;
          let state: UsernameState = { status: 'available' };
          if (!res.available) {
            state =
              res.reason === 'reserved'
                ? { status: 'taken', message: 'That username is reserved.' }
                : res.reason === 'invalid'
                  ? { status: 'invalid', message: 'That username isn’t allowed.' }
                  : { status: 'taken', message: 'That username is taken.' };
          }
          setRemote({ username, state });
        })
        .catch(() => !cancelled && setRemote({ username, state: { status: 'unknown' } }));
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, problem]);

  if (!username) return { status: 'idle' };
  if (problem) return { status: 'invalid', message: problem };
  if (remote.username !== username) return { status: 'checking' };
  return remote.state;
}
