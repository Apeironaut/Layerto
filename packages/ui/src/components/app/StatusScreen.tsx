import type { ReactNode } from 'react';
import { LayertoLogo } from '../LayertoLogo';
import { ThemeToggle } from '../ThemeToggle';
import { Icon } from '../Icon';
import type { IconName } from '../Icon';
import { cn } from '../../lib/cn';

export interface StatusScreenProps {
  icon: IconName;
  tone: 'pending' | 'danger';
  title: string;
  children: ReactNode;
  actions: ReactNode;
}

/** A single message screen (e.g. account pending approval, suspended). */
export function StatusScreen({ icon, tone, title, children, actions }: StatusScreenProps) {
  return (
    <div className="min-h-screen bg-page text-ink flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <LayertoLogo size={32} />
          <span className="font-bold">Layerto</span>
        </div>
        <ThemeToggle />
      </header>
      <main className="flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-md rounded-l1 bg-card border border-line shadow-l2 p-8 text-center">
          <div
            className={cn(
              'mx-auto h-14 w-14 rounded-full flex items-center justify-center',
              tone === 'pending' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-crimson-tint text-crimson',
            )}
          >
            <Icon name={icon} size={26} />
          </div>
          <h1 className="mt-5 text-xl font-bold">{title}</h1>
          <div className="mt-2 text-sm text-muted leading-relaxed">{children}</div>
          <div className="mt-6 flex justify-center gap-3">{actions}</div>
        </div>
      </main>
    </div>
  );
}
