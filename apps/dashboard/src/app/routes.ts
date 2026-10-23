import type { NavItem } from '@layerto/ui';

/** Builds the sidebar for the user's plan features and account type. Locked items explain how to unlock them. */
export function buildNav(features: string[], track: string, counts: { invites?: number } = {}): NavItem[] {
  const has = (f: string) => features.includes(f);
  const top: NavItem[] = [
    { path: '/home', label: 'Home', icon: 'home', shortLabel: 'Home' },
    { path: '/overview', label: 'Overview', icon: 'overview', hideOnMobile: true },
  ];
  const build: NavItem[] = [
    { path: '/playground', label: 'Playground', icon: 'spark', group: 'Build' },
    { path: '/projects', label: 'Projects', icon: 'folder', group: 'Build', locked: !has('projects') },
    { path: '/models', label: 'Models', icon: 'box', group: 'Build', locked: !has('train'), hideOnMobile: true },
    { path: '/workflows', label: 'Workflows', icon: 'layers', group: 'Build', hideOnMobile: true },
  ];
  const research: NavItem[] = [
    { path: '/research', label: 'Research', icon: 'flask', group: 'Research', locked: !has('research'), shortLabel: 'Research' },
  ];
  const market: NavItem[] = [
    { path: '/marketplace', label: 'Marketplace', icon: 'store', group: 'Community', shortLabel: 'Market' },
    { path: '/sell', label: 'Sell', icon: 'camera', group: 'Community', locked: !(has('sell_images') || has('sell_models')), hideOnMobile: track !== 'photographer' },
    { path: '/teams', label: 'Teams', icon: 'team', group: 'Community', count: counts.invites || undefined, hideOnMobile: true },
  ];
  const dev: NavItem[] = [
    { path: '/keys', label: 'API keys', shortLabel: 'Keys', icon: 'key', group: 'Developers', hideOnMobile: true },
    { path: '/usage', label: 'Usage', icon: 'chart', group: 'Developers', hideOnMobile: true },
    { path: '/requests', label: 'Requests', icon: 'list', group: 'Developers', hideOnMobile: true },
  ];
  if (track === 'photographer') {
    market.forEach((m) => (m.group = 'Sell'));
    return [...top, ...market, ...build.map((b) => ({ ...b, hideOnMobile: true })), ...research.map((r) => ({ ...r, hideOnMobile: true })), ...dev];
  }
  if (track === 'researcher') return [...top, ...research, ...build, ...market, ...dev];
  return [...top, ...build, ...research, ...market, ...dev];
}

const PREFIXES = ['/workflows', '/projects', '/datasets', '/research', '/marketplace', '/models', '/teams', '/home', '/sell'];

/** Maps any URL path to a nav section (unknown paths fall back to home). */
export function resolveSection(path: string): string {
  for (const p of PREFIXES) if (path === p || path.startsWith(`${p}/`)) return p === '/datasets' ? '/projects' : p;
  const known = ['/overview', '/playground', '/keys', '/usage', '/requests'];
  if (known.includes(path)) return path;
  return '/home';
}
