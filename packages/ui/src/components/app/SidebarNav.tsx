import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { Icon } from '../Icon';
import type { NavItem } from './types';

export interface SidebarNavProps {
  items: NavItem[];
  activePath: string;
  onNavigate: (path: string) => void;
  /** Icons only (labels become tooltips). */
  compact?: boolean;
}

/** Vertical navigation; the active highlight slides between items. */
export function SidebarNav({ items, activePath, onNavigate, compact = false }: SidebarNavProps) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {items.map((item, i) => {
        const active = item.path === activePath;
        const heading = item.group && item.group !== items[i - 1]?.group ? item.group : null;
        return (
          <div key={item.path} className="contents">
            {heading && !compact && (
              <div className="px-3 pt-5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted/80">{heading}</div>
            )}
            {heading && compact && <div className="mx-3 my-2.5 border-t border-line" />}
            <a
              href={item.path}
              aria-current={active ? 'page' : undefined}
              title={compact ? item.label + (item.locked ? ' (upgrade)' : '') : undefined}
              aria-label={compact ? item.label : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(item.path);
              }}
              className={cn(
                'group no-underline relative flex items-center gap-3 py-2 rounded-control text-[13.5px] font-medium cursor-pointer transition-colors',
                compact ? 'justify-center px-0 h-10' : 'px-3',
                active ? 'text-white' : 'text-ink-secondary hover:text-ink hover:bg-page',
                item.locked && !active && 'text-muted',
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-control bg-crimson dark:bg-crimson-fill shadow-l1"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <Icon name={item.icon} size={18} className="relative shrink-0 transition-transform group-hover:scale-110" />
              {!compact && <span className="relative flex-1 truncate">{item.label}</span>}
              {!compact && item.locked && <Icon name="lock" size={14} className={cn('relative', active ? 'text-white/80' : 'text-muted')} />}
              {!compact && item.badge && !item.locked && (
                <span className={cn('relative rounded-pill px-1.5 py-0.5 text-[10px] font-semibold', active ? 'bg-white/20 text-white' : 'bg-crimson-tint text-crimson')}>
                  {item.badge}
                </span>
              )}
              {!compact && typeof item.count === 'number' && (
                <span
                  className={cn(
                    'relative min-w-6 px-1.5 py-0.5 rounded-pill text-[11px] text-center font-mono',
                    active ? 'bg-white/20 text-white' : 'bg-line text-muted',
                  )}
                >
                  {item.count}
                </span>
              )}
              {compact && (item.locked || typeof item.count === 'number') && (
                <span className={cn('absolute top-1.5 right-2.5 size-1.5 rounded-full', item.locked ? 'bg-muted' : 'bg-crimson')} />
              )}
            </a>
          </div>
        );
      })}
    </nav>
  );
}
