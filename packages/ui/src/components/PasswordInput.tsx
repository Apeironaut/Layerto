import { useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { FIELD_CLASSES } from './Input';
import { Icon } from './Icon';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string | null;
  helperText?: ReactNode;
  /** Extra content under the field (e.g. a checklist). */
  below?: ReactNode;
}

/** Password field with a show/hide toggle. */
export function PasswordInput({ label, error, helperText, below, className, id: givenId, ...props }: PasswordInputProps) {
  const autoId = useId();
  const id = givenId || autoId;
  const [visible, setVisible] = useState(false);
  const describedBy = error ? `${id}-error` : helperText ? `${id}-helper` : undefined;
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      <label htmlFor={id} className="text-xs font-semibold text-ink-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(FIELD_CLASSES, 'cursor-text pr-11', error && 'border-crimson', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-muted hover:text-ink cursor-pointer rounded-r-control"
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-crimson">
          {error}
        </p>
      ) : (
        helperText && (
          <p id={`${id}-helper`} className="text-xs text-muted">
            {helperText}
          </p>
        )
      )}
      {below}
    </div>
  );
}
