import { useCallback, useEffect, useState } from 'react';
import type { SignupParams, User } from '@layerto/types';
import { api } from '../lib/api';

export type Session =
  | { status: 'checking' }
  | { status: 'signed-out'; notice?: string }
  | { status: 'signed-in'; user: User };

const ADMIN_NOT_ALLOWED = "This is an admin account. Admin accounts can't use the dashboard.";

export class AdminNotAllowedError extends Error {
  constructor() {
    super(ADMIN_NOT_ALLOWED);
    this.name = 'AdminNotAllowedError';
  }
}

/** Who is signed in. Checks the session cookie on load; rejects admin accounts; exposes sign in / up / out. */
export function useSession() {
  const [session, setSession] = useState<Session>({ status: 'checking' });

  const rejectAdmin = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setSession({ status: 'signed-out', notice: ADMIN_NOT_ALLOWED });
  }, []);

  /** Re-checks the session; returns the current user, or null if signed out / rejected. */
  const refresh = useCallback(async (): Promise<User | null> => {
    try {
      const user = await api.me();
      if (user.role === 'admin') {
        await rejectAdmin();
        return null;
      }
      setSession({ status: 'signed-in', user });
      return user;
    } catch {
      setSession({ status: 'signed-out' });
      return null;
    }
  }, [rejectAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (login: string, password: string) => {
      const user = await api.login({ login, password });
      if (user.role === 'admin') {
        await rejectAdmin();
        throw new AdminNotAllowedError();
      }
      setSession({ status: 'signed-in', user });
    },
    [rejectAdmin],
  );

  /** Creates the account, then signs in so the person sees their pending status. */
  const signUp = useCallback(
    async (params: SignupParams) => {
      await api.signup(params);
      try {
        const user = await api.login({ login: params.username, password: params.password });
        if (user.role === 'admin') {
          await rejectAdmin();
          return;
        }
        setSession({ status: 'signed-in', user });
      } catch (err) {
        if (err instanceof AdminNotAllowedError) throw err;
        setSession({ status: 'signed-out' });
      }
    },
    [rejectAdmin],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setSession({ status: 'signed-out' });
    }
  }, []);

  /** Replaces the signed-in user after a profile change. */
  const updateUser = useCallback((user: User) => setSession({ status: 'signed-in', user }), []);

  return { session, refresh, signIn, signUp, signOut, updateUser };
}
