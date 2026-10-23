import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';

export interface ModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** When false, Escape/backdrop/close button do nothing (e.g. key not yet saved). */
  dismissable?: boolean;
  /** Panel width. */
  size?: 'md' | 'lg' | 'xl';
}

const SIZES = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

/** Layer-3 dialog: focus moves inside on open and returns on close; Escape closes. */
export function Modal({ isOpen, open, onClose, title, description, children, dismissable = true, size = 'md' }: ModalProps) {
  const isModalOpen = isOpen ?? open ?? false;
  const titleId = useId();
  const descId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isModalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [isModalOpen, onClose, dismissable]);

  const modalContent = (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 dark:bg-black/75 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && dismissable) onClose();
          }}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={`relative z-10 w-full ${SIZES[size]} max-h-[90svh] overflow-y-auto rounded-l3 bg-card border border-line-strong shadow-l3 p-6 text-ink outline-none`}
            initial={{ opacity: 0, y: 16, scale: 0.97, rotateX: 6 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{ transformPerspective: 900 }}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 id={titleId} className="text-lg font-bold">
                  {title}
                </h2>
                {description && (
                  <div id={descId} className="text-sm text-muted mt-1">
                    {description}
                  </div>
                )}
              </div>
              {dismissable && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 -m-1 rounded-control text-muted hover:text-ink hover:bg-crimson-tint cursor-pointer transition-colors"
                  aria-label="Close"
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}
