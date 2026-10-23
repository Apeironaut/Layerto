import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, LayertoLogo, ThemeToggle, cn } from '@layerto/ui';
import { DASHBOARD_URL } from '../../config';

const LINKS = [
  { to: '/#what-we-do', label: 'What we do' },
  { to: '/#products', label: 'Products' },
  { to: '/#hub', label: 'Hub' },
  { to: '/#studio', label: 'Studio' },
  { to: '/papers', label: 'Papers' },
  { to: '/#pricing', label: 'Pricing' },
  { to: '/#faq', label: 'FAQ' },
  { to: '/docs', label: 'Docs' },
];

export interface SiteNavbarProps {
  path: string;
  navigate: (to: string) => void;
}

/** Sticky top bar: logo, section links, theme, dashboard. Collapses into a menu on mobile. */
export function SiteNavbar({ path, navigate }: SiteNavbarProps) {
  const [open, setOpen] = useState(false);
  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-page/85 backdrop-blur-md border-b border-line">
      <div className="w-full px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go('/');
          }}
          className="no-underline flex items-center gap-2.5 rounded-control"
          aria-label="Layerto home"
        >
          <LayertoLogo size={32} />
          <span className="text-lg font-bold tracking-tight text-ink">Layerto</span>
        </a>

        <nav aria-label="Main" className="hidden lg:flex items-center gap-1 text-sm font-medium">
          {LINKS.map((l) => {
            const active = l.to === path;
            return (
              <a
                key={l.to}
                href={l.to}
                onClick={(e) => {
                  e.preventDefault();
                  go(l.to);
                }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'no-underline px-3 py-2 rounded-control transition-colors',
                  active ? 'text-crimson' : 'text-muted hover:text-ink hover:bg-card',
                )}
              >
                {l.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle compact className="sm:hidden" />
          <ThemeToggle className="hidden sm:inline-flex" />
          <a
            href={DASHBOARD_URL}
            className="no-underline hidden sm:inline-flex items-center px-4 py-2 rounded-control bg-crimson dark:bg-crimson-fill text-white text-sm font-semibold hover:bg-crimson-hover dark:hover:bg-crimson active:scale-[0.97] transition-colors"
          >
            Dashboard
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="lg:hidden p-2 rounded-control border border-line bg-card text-ink cursor-pointer"
          >
            <Icon name={open ? 'close' : 'list'} size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="site-menu"
            aria-label="Main"
            className="lg:hidden border-t border-line bg-card px-4 py-3 flex flex-col"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {LINKS.map((l) => (
              <a
                key={l.to}
                href={l.to}
                onClick={(e) => {
                  e.preventDefault();
                  go(l.to);
                }}
                className="no-underline px-2 py-3 text-base font-medium text-ink border-b border-line last:border-0"
              >
                {l.label}
              </a>
            ))}
            <a
              href={DASHBOARD_URL}
              className="no-underline mt-3 inline-flex justify-center px-4 py-3 rounded-control bg-crimson dark:bg-crimson-fill text-white font-semibold"
            >
              Open the dashboard
            </a>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
