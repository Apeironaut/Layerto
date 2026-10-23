import { useCallback, useEffect, useState } from 'react';
import type { User } from '@layerto/types';
import { api } from '../lib/api';

export type AdminSession =
  | { status: 'checking' }
  | { status: 'signed-out'; notice?: string }
  | { status: 'signed-in'; user: User };

const NOT_ADMIN = 'This account is not an admin. Use the dashboard instead.';

/** Thrown by signIn when the credentials are valid but the account isn't an admin. */
export class NotAdminError extends Error {
  constructor() {
    super(NOT_ADMIN);
    this.name = 'NotAdminError';
  }
}

/** Admin-only session: any non-admin session is signed out straight away. */
export function useAdminSession() {
  const [session, setSession] = useState<AdminSession>({ status: 'checking' });

  const reject = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setSession({ status: 'signed-out', notice: NOT_ADMIN });
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((user) => {
        if (cancelled) return;
        if (user.role === 'admin') setSession({ status: 'signed-in', user });
        else void reject();
      })
      .catch(() => !cancelled && setSession({ status: 'signed-out' }));
    return () => {
      cancelled = true;
    };
  }, [reject]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const user = await api.login({ login: email, password });
      if (user.role !== 'admin') {
        await reject();
        throw new NotAdminError();
      }
      setSession({ status: 'signed-in', user });
    },
    [reject],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setSession({ status: 'signed-out' });
    }
  }, []);

  return { session, signIn, signOut };
}
