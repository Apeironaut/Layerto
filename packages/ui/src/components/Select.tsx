import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { FIELD_CLASSES } from './Input';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  options: SelectOption[];
}

export function Select({ label, options, className, id: givenId, ...props }: SelectProps) {
  const autoId = useId();
  const id = givenId || autoId;
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-ink-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <select id={id} className={cn(FIELD_CLASSES, 'appearance-none pr-9 cursor-pointer', className)} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="arrowDown" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}
