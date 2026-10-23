import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  /** Shows a spinner and disables the button while an action runs. */
  loading?: boolean;
}

const BASE =
  'relative inline-flex items-center justify-center font-semibold rounded-control select-none cursor-pointer ' +
  'transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out ' +
  'focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 ' +
  'active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ' +
  'motion-reduce:transition-none motion-reduce:active:scale-100';

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2.5 gap-2',
  lg: 'text-base px-6 py-3 gap-2.5',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-crimson dark:bg-crimson-fill text-white border border-transparent dark:border-crimson-border shadow-l1 ' +
    'hover:bg-crimson-hover dark:hover:bg-crimson hover:shadow-l2',
  secondary:
    'bg-card text-ink border border-line hover:bg-crimson-tint hover:border-crimson-border hover:text-crimson',
  danger: 'bg-crimson-fill text-white border border-transparent hover:bg-crimson shadow-l1',
  outline: 'bg-transparent text-ink border border-line-strong hover:border-crimson hover:text-crimson',
  ghost: 'bg-transparent text-muted border border-transparent hover:text-ink hover:bg-crimson-tint',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
  return (
    <button
      type={type}
      className={cn(BASE, SIZES[size], VARIANTS[variant], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="inline-block rounded-full border-2 border-current border-r-transparent animate-spin motion-reduce:animate-none"
          style={{ width: iconSize, height: iconSize }}
        />
      ) : (
        icon && <Icon name={icon} size={iconSize} />
      )}
      {children}
    </button>
  );
}
