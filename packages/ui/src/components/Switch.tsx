import { useId } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

/** On/off toggle with a label (role="switch"). */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className={cn('min-w-0 cursor-pointer', disabled && 'opacity-50 cursor-not-allowed')}>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-muted mt-0.5">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative shrink-0 h-6 w-11 rounded-pill transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed',
          'focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2',
          checked ? 'bg-crimson dark:bg-crimson-fill' : 'bg-line-strong',
        )}
      >
        <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-5')} />
      </button>
    </div>
  );
}
