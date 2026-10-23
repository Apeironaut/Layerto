import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  helperText?: ReactNode;
}

export const FIELD_CLASSES =
  'w-full px-3.5 py-2.5 bg-card text-ink text-sm rounded-control border border-line ' +
  'placeholder:text-muted/70 transition-colors duration-150 ' +
  'hover:border-line-strong focus:border-crimson focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export function Input({ label, error, helperText, className, id: givenId, ...props }: InputProps) {
  const autoId = useId();
  const id = givenId || autoId;
  const describedBy = error ? `${id}-error` : helperText ? `${id}-helper` : undefined;
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-ink-secondary">
          {label}
        </label>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(FIELD_CLASSES, 'cursor-text', error && 'border-crimson', className)}
        {...props}
      />
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
    </div>
  );
}
