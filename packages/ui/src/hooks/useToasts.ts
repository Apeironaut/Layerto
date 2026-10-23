import { useCallback, useRef, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  tone: ToastTone;
}

export interface Toasts {
  toasts: ToastMessage[];
  notify: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

/** Toast queue: each toast auto-dismisses after 4 seconds (errors stay 7 seconds). */
export function useToasts(): Toasts {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      counter.current += 1;
      const id = `t${counter.current}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  return { toasts, notify, dismiss };
}
