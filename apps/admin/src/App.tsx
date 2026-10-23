import { useCallback, useState } from 'react';
import { ToastProvider } from '@layerto/ui';
import { SignInPage } from './auth/SignInPage';
import { AdminApp } from './app/AdminApp';
import { useAdminSession } from './hooks/useAdminSession';
import { useAdminBoot } from './hooks/useAdminBoot';
import type { UserFilter } from './hooks/useUsers';

/** Session gate: admins get the console, everyone else the sign-in screen. */
function Gate() {
  const { session, signIn, signOut } = useAdminSession();
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<UserFilter>('pending');
  const markReady = useCallback(() => setReady(true), []);
  useAdminBoot(session, ready);

  if (session.status === 'checking') return null; // boot screen still showing
  if (session.status === 'signed-out') return <SignInPage notice={session.notice} onSignIn={signIn} />;
  return <AdminApp user={session.user} filter={filter} onFilter={setFilter} onReady={markReady} onSignOut={signOut} />;
}

export default function App() {
  return (
    <ToastProvider>
      <Gate />
    </ToastProvider>
  );
}
