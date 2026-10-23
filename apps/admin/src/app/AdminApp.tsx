import { useEffect } from 'react';
import type { User } from '@layerto/types';
import { AppShell, useRoute } from '@layerto/ui';
import { NAV, resolveSection } from './routes';
import { OverviewPage } from '../pages/OverviewPage';
import { UsersPage } from '../pages/UsersPage';
import { ModelsPage } from '../pages/ModelsPage';
import { RoutesPage } from '../pages/RoutesPage';
import { ActivityPage } from '../pages/ActivityPage';
import { LedgerPage } from '../pages/LedgerPage';
import { SettingsPage } from '../pages/SettingsPage';
import { StudioPage } from '../pages/StudioPage';
import { HubPage } from '../pages/HubPage';
import type { UserFilter } from '../hooks/useUsers';
import { useUsers } from '../hooks/useUsers';

export interface AdminAppProps {
  user: User;
  filter: UserFilter;
  onFilter: (f: UserFilter) => void;
  onReady: () => void;
  onSignOut: () => void;
}

/** Signed-in admin: shell + current section. */
export function AdminApp({ user, filter, onFilter, onReady, onSignOut }: AdminAppProps) {
  const [path, navigate] = useRoute();
  const section = resolveSection(path);
  // Pending count for the sidebar badge (also the boot screen's "admin data" milestone).
  const pending = useUsers('pending');
  const settled = !pending.loading;
  useEffect(() => {
    if (settled) onReady();
  }, [settled, onReady]);

  const nav = NAV.map((n) => (n.path === '/users' && pending.data?.length ? { ...n, count: pending.data.length } : n));

  let page;
  switch (section) {
    case '/users':
      page = (
        <UsersPage
          filter={filter}
          onFilter={onFilter}
          onChanged={() => void pending.reload()}
        />
      );
      break;
    case '/models':
      page = <ModelsPage />;
      break;
    case '/studio':
      page = <StudioPage />;
      break;
    case '/hub':
      page = <HubPage />;
      break;
    case '/routing':
      page = <RoutesPage />;
      break;
    case '/activity':
      page = <ActivityPage />;
      break;
    case '/settings':
      page = <SettingsPage user={user} />;
      break;
    case '/ledger':
      page = <LedgerPage />;
      break;
    case '/overview':
    default:
      page = (
        <OverviewPage
          navigate={navigate}
          onUserChanged={() => void pending.reload()}
        />
      );
  }

  return (
    <AppShell
      product="Admin"
      nav={nav}
      activePath={section}
      onNavigate={navigate}
      userEmail={user.email}
      userDetail="Administrator"
      onSignOut={onSignOut}
    >
      {page}
    </AppShell>
  );
}
