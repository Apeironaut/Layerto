import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

/** Shown when a list has nothing yet: says what to do next. */
export function EmptyState({ icon = 'layers', title, description, action }: EmptyStateProps) {
  return (
    <div className="py-12 px-4 flex flex-col items-center text-center">
      <div className="h-12 w-12 rounded-l2 bg-crimson-tint text-crimson flex items-center justify-center">
        <Icon name={icon} size={22} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted max-w-[46ch]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
