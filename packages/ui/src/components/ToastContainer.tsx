import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/cn';
import type { ToastMessage } from '../hooks/useToasts';
import { Icon } from './Icon';

export interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const TONE = {
  success: { icon: 'check' as const, cls: 'text-emerald-700 dark:text-emerald-300' },
  error: { icon: 'alert' as const, cls: 'text-crimson' },
  info: { icon: 'info' as const, cls: 'text-muted' },
};

/** Bottom-right stack of toasts (above the mobile nav on small screens). */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      className="fixed z-[60] right-4 left-4 sm:left-auto bottom-20 md:bottom-6 sm:w-[22rem] flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-l2 bg-card border border-line-strong shadow-l3 text-sm text-ink"
          >
            <Icon name={TONE[t.tone].icon} size={18} className={cn('mt-0.5 shrink-0', TONE[t.tone].cls)} />
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="p-1 -m-1 rounded-control text-muted hover:text-ink cursor-pointer"
              aria-label="Dismiss"
            >
              <Icon name="close" size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
