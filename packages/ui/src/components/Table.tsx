import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/** Scrollable table wrapper with consistent spacing. Compose with THead/Th/Tr/Td. */
export function Table({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div className={cn('relative overflow-x-auto -mx-5 sm:-mx-6', className)}>
      <table aria-label={label} className="w-full text-sm text-left">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="text-xs text-muted border-b border-line">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn('py-2.5 px-5 sm:px-6 font-medium whitespace-nowrap', className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-line last:border-0 transition-colors hover:bg-page/60', className)} {...props} />;
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('py-3 px-5 sm:px-6 align-middle', className)} {...props} />;
}
