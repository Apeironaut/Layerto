import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LayertoLogo } from '../LayertoLogo';
import { ThemeToggle } from '../ThemeToggle';
import { Icon } from '../Icon';
import { SidebarNav } from './SidebarNav';
import { MobileNav } from './MobileNav';
import type { AccountMenuItem, NavItem } from './types';
import { cn } from '../../lib/cn';

export interface AppShellProps {
  /** Shown under "Layerto", e.g. "Dashboard" or "Admin". */
  product: string;
  nav: NavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  userEmail: string;
  /** Display name on the account button (falls back to the email). */
  userName?: string;
  /** Small status line under the name (e.g. balance or plan). */
  userDetail?: ReactNode;
  onSignOut: () => void;
  /** Entries of the account menu that opens from the name (sign out is always added last). */
  accountMenu?: AccountMenuItem[];
  /** Extra content at the top of the account menu (e.g. plan badge). */
  accountHeader?: ReactNode;
  /** Sidebar collapsed to icons (controlled). */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Buttons shown next to the logo area / mobile header (e.g. search). */
  toolbar?: ReactNode;
  /** When true, removes standard padding to allow full-bleed layouts like canvas editors. */
  fullBleed?: boolean;
  /** Narrow icon-only sidebar, for wide tools like the workflow editor. */
  compactNav?: boolean;
  children: ReactNode;
}

function initials(name: string) {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function AccountMenu({
  open,
  onClose,
  items,
  header,
  onSignOut,
  placement,
}: {
  open: boolean;
  onClose: () => void;
  items: AccountMenuItem[];
  header?: ReactNode;
  onSignOut: () => void;
  placement: 'up' | 'down';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = setTimeout(() => document.addEventListener('mousedown', onDoc));
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          initial={{ opacity: 0, y: placement === 'up' ? 8 : -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: placement === 'up' ? 6 : -6, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'absolute z-50 w-72 rounded-l2 border border-line bg-raised shadow-l3 p-1.5',
            placement === 'up' ? 'bottom-full mb-2 left-0' : 'top-full mt-2 right-0',
          )}
        >
          {header && <div className="px-3 py-2.5 border-b border-line mb-1">{header}</div>}
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                it.onSelect();
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-control text-sm text-left cursor-pointer transition-colors',
                it.danger ? 'text-crimson hover:bg-crimson-tint' : 'text-ink hover:bg-page',
              )}
            >
              <Icon name={it.icon} size={17} className="text-muted shrink-0" />
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="text-[11px] text-muted">{it.hint}</span>}
            </button>
          ))}
          <div className="flex items-center gap-2 px-2 pt-2 mt-1 border-t border-line">
            <ThemeToggle className="flex-1 justify-center" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-control border border-line text-xs font-semibold text-ink-secondary hover:text-crimson hover:border-crimson-border hover:bg-crimson-tint cursor-pointer transition-colors"
            >
              <Icon name="logout" size={15} />
              Sign out
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Layout shared by the dashboard and admin apps: a collapsible sidebar on desktop with the account
 * menu under the user's name, a top bar + bottom tabs on mobile. Page changes cross-fade with a short rise.
 */
export function AppShell({
  product,
  nav,
  activePath,
  onNavigate,
  userEmail,
  userName,
  userDetail,
  onSignOut,
  accountMenu = [],
  accountHeader,
  collapsed = false,
  onToggleCollapsed,
  toolbar,
  fullBleed = false,
  compactNav = false,
  children,
}: AppShellProps) {
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const compact = compactNav || collapsed;
  const display = userName?.trim() || userEmail;

  return (
    <div className="min-h-screen bg-page text-ink md:flex">
      <aside
        className={cn(
          'hidden md:flex md:flex-col shrink-0 h-screen sticky top-0 border-r border-line bg-card transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-30',
          compact ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className={cn('pt-5 pb-3 flex items-center gap-3', compact ? 'justify-center px-2 flex-col' : 'px-4')}>
          <LayertoLogo size={compact ? 30 : 34} />
          {!compact && (
            <div className="leading-tight flex-1 min-w-0">
              <div className="font-bold text-base">Layerto</div>
              <div className="text-xs text-muted truncate">{product}</div>
            </div>
          )}
          {onToggleCollapsed && !compactNav && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}
              className="p-1.5 rounded-control text-muted hover:text-ink hover:bg-page cursor-pointer transition-colors"
            >
              <Icon name="sidebar" size={18} />
            </button>
          )}
        </div>
        {toolbar && <div className={cn('pb-2', compact ? 'px-2 flex justify-center' : 'px-3')}>{toolbar}</div>}
        <div className={cn('flex-1 overflow-y-auto overflow-x-hidden pb-4', compact ? 'px-2' : 'px-3')}>
          <SidebarNav items={nav} activePath={activePath} onNavigate={onNavigate} compact={compact} />
        </div>
        <div className={cn('relative border-t border-line', compact ? 'p-2' : 'p-3')}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={compact ? display : undefined}
            className={cn(
              'w-full flex items-center gap-3 rounded-control cursor-pointer transition-colors hover:bg-page text-left',
              compact ? 'justify-center p-1.5' : 'p-2',
              menuOpen && 'bg-page',
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-crimson to-crimson-hover text-white text-sm font-bold shadow-l1">
              {initials(display)}
            </span>
            {!compact && (
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold truncate">{display}</span>
                {userDetail && <span className="block text-xs text-muted truncate">{userDetail}</span>}
              </span>
            )}
            {!compact && <Icon name="chevronDown" size={16} className={cn('text-muted transition-transform', menuOpen && 'rotate-180')} />}
          </button>
          <AccountMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            items={accountMenu}
            header={
              <div>
                <div className="text-sm font-semibold truncate">{display}</div>
                <div className="text-xs text-muted truncate">{userEmail}</div>
                {accountHeader}
              </div>
            }
            onSignOut={onSignOut}
            placement="up"
          />
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-line px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LayertoLogo size={30} />
          <span className="font-bold">Layerto</span>
          <span className="text-xs text-muted">{product}</span>
        </div>
        <div className="relative flex items-center gap-2">
          {toolbar}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-label="Account"
            className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-crimson to-crimson-hover text-white text-sm font-bold cursor-pointer"
          >
            {initials(display)}
          </button>
          <AccountMenu
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            items={accountMenu}
            header={
              <div>
                <div className="text-sm font-semibold truncate">{display}</div>
                {userDetail && <div className="text-xs text-muted">{userDetail}</div>}
                {accountHeader}
              </div>
            }
            onSignOut={onSignOut}
            placement="down"
          />
        </div>
      </header>

      <main className={cn('flex-1 min-w-0 flex flex-col', fullBleed ? 'p-0 pb-16 md:pb-0' : 'px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-8')}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activePath}
            className={cn('w-full', fullBleed ? 'h-full flex-1 flex flex-col' : 'space-y-6 max-w-[1600px] mx-auto')}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileNav items={nav.filter((n) => !n.hideOnMobile)} activePath={activePath} onNavigate={onNavigate} />
    </div>
  );
}
