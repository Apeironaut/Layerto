import type { NavItem } from '@layerto/ui';

/** Admin sections, in sidebar order. "/" opens overview. */
export const NAV: NavItem[] = [
  { path: '/overview', label: 'Overview', icon: 'overview' },
  { path: '/users', label: 'Users', icon: 'users' },
  { path: '/models', label: 'Models', icon: 'cpu' },
  { path: '/studio', label: 'Studio', icon: 'box' },
  { path: '/hub', label: 'Hub', icon: 'users' },
  { path: '/routing', label: 'Routing', icon: 'route' },
  { path: '/activity', label: 'Activity', icon: 'list' },
  { path: '/ledger', label: 'Ledger', icon: 'shield' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

export function resolveSection(path: string): string {
  return NAV.some((n) => n.path === path) ? path : '/overview';
}
