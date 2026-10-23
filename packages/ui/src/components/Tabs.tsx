import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '../lib/cn';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
  count?: number;
  locked?: boolean;
}

/** Underlined tabs with a sliding indicator; scrolls horizontally on small screens. */
export function Tabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  const id = useId();
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-line -mx-1 px-1', className)}>
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium cursor-pointer transition-colors',
              active ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {t.icon && <Icon name={t.icon} size={16} />}
            {t.label}
            {typeof t.count === 'number' && <span className="rounded-pill bg-line px-1.5 text-[11px] font-mono text-muted">{t.count}</span>}
            {t.locked && <Icon name="lock" size={13} className="text-muted" />}
            {active && <motion.span layoutId={`tab-${id}`} className="absolute inset-x-1 -bottom-px h-0.5 rounded-pill bg-crimson" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          </button>
        );
      })}
    </div>
  );
}
