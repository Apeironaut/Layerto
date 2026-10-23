import { cn } from '../../lib/cn';
import { Icon } from '../Icon';
import type { NavItem } from './types';

export interface MobileNavProps {
  items: NavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
}

/** Fixed bottom tab bar for screens under 768px. */
export function MobileNav({ items, activePath, onNavigate }: MobileNavProps) {
  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md border-t border-line flex justify-around overflow-x-auto px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
    >
      {items.map((item) => {
        const active = item.path === activePath;
        return (
          <a
            key={item.path}
            href={item.path}
            aria-current={active ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(item.path);
            }}
            className={cn(
              'no-underline shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 min-w-14 rounded-control text-[11px] font-medium cursor-pointer transition-colors',
              active ? 'text-crimson' : 'text-muted hover:text-ink',
            )}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.shortLabel ?? item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
