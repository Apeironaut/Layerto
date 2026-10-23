import { useState } from 'react';
import { cn } from '../lib/cn';
import { applyThemeMode, readThemeMode } from '../lib/theme';
import type { ThemeMode } from '../lib/theme';
import { Icon } from './Icon';

const NEXT: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' };
const ICON = { light: 'sun', dark: 'moon', system: 'monitor' } as const;
const LABEL: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };

/** Cycles light → dark → system. `compact` shows the icon only. */
export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode);
  const next = NEXT[mode];
  return (
    <button
      type="button"
      onClick={() => {
        applyThemeMode(next);
        setMode(next);
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-control border border-line bg-card text-ink text-xs font-semibold cursor-pointer',
        'hover:bg-crimson-tint hover:border-crimson-border hover:text-crimson transition-colors',
        compact ? 'p-2' : 'px-2.5 py-1.5',
        className,
      )}
      aria-label={`Theme: ${LABEL[mode]}. Switch to ${LABEL[next]}.`}
      title={`Theme: ${LABEL[mode]}`}
    >
      <Icon name={ICON[mode]} size={16} />
      {!compact && <span>{LABEL[mode]}</span>}
    </button>
  );
}
