import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useToasts } from '../hooks/useToasts';
import type { ToastTone } from '../hooks/useToasts';
import { ToastContainer } from './ToastContainer';

type Notify = (message: string, tone?: ToastTone) => void;

const NotifyContext = createContext<Notify>(() => {});

/** Provides toasts to everything below it and renders the toast stack. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, notify, dismiss } = useToasts();
  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </NotifyContext.Provider>
  );
}

/** Show a toast from any component inside ToastProvider. */
export function useNotify(): Notify {
  return useContext(NotifyContext);
}
