import { ToastProvider, useRoute } from '@layerto/ui';
import { AuthPage } from './auth/AuthPage';
import { PendingPage } from './auth/PendingPage';
import { SuspendedPage } from './auth/SuspendedPage';
import { ResetPasswordPage } from './auth/ResetPasswordPage';
import { SignedInApp } from './app/SignedInApp';
import { useSession } from './hooks/useSession';
import { useBalance } from './hooks/useBalance';
import { useDashboardBoot } from './hooks/useDashboardBoot';

/** Session gate: picks the screen for who is (or isn't) signed in. */
function Gate() {
  const { session, refresh, signIn, signUp, signOut, updateUser } = useSession();
  const [path, navigate] = useRoute();
  const active = session.status === 'signed-in' && session.user.status === 'active';
  const balance = useBalance(active);
  useDashboardBoot(session, !balance.loading);

  // Reset links work whether or not someone is signed in on this browser.
  if (path === '/reset-password') {
    return (
      <ResetPasswordPage
        onDone={() => {
          navigate('/');
          void refresh();
        }}
      />
    );
  }
  if (session.status === 'checking') return null; // the boot screen is still showing
  if (session.status === 'signed-out') return <AuthPage notice={session.notice} onSignIn={signIn} onSignUp={signUp} />;

  const { user } = session;
  if (user.status === 'pending') return <PendingPage email={user.email} onRecheck={refresh} onSignOut={signOut} />;
  if (user.status !== 'active') return <SuspendedPage onSignOut={signOut} />;

  return (
    <SignedInApp
      user={user}
      balance={balance.data}
      balanceLoading={balance.loading}
      reloadBalance={() => void balance.reload()}
      onSignOut={signOut}
      onUserChange={updateUser}
    />
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Gate />
    </ToastProvider>
  );
}
