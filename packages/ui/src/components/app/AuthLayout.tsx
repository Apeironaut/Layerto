import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { LayertoLogo } from '../LayertoLogo';
import { ThemeToggle } from '../ThemeToggle';

export interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Full-screen sign-in layout: the logo's layer colours as a soft backdrop on the left
 * (desktop), the form card on the right. Used by dashboard and admin.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const reduced = useReducedMotion();
  return (
    <div className="min-h-screen bg-page text-ink grid lg:grid-cols-2">
      <div className="hidden lg:flex relative overflow-hidden bg-[#15161A] text-white p-12 flex-col justify-between">
        <div aria-hidden="true" className="absolute inset-0">
          {[
            'top-[18%] -left-16 w-[70%] h-28 bg-[#2A2C33] -rotate-6',
            'top-[42%] -right-10 w-[62%] h-24 bg-[#A3122A] rotate-3',
            'top-[64%] left-10 w-[55%] h-20 bg-[#6E0E1C] -rotate-2',
          ].map((cls, i) => (
            <motion.div
              key={cls}
              className={`absolute rounded-l1 opacity-90 ${cls}`}
              initial={reduced ? false : { opacity: 0, x: i % 2 ? 60 : -60 }}
              animate={{ opacity: 0.9, x: 0 }}
              transition={{ delay: 0.1 + i * 0.12, type: 'spring', stiffness: 90, damping: 18 }}
            />
          ))}
        </div>
        <div className="relative flex items-center gap-3">
          <div className="rounded-l2 bg-white p-2">
            <LayertoLogo size={40} />
          </div>
          <span className="text-xl font-bold">Layerto</span>
        </div>
        <div className="relative">
          <p className="text-3xl font-bold leading-tight max-w-[18ch] !text-white">The layer between AI and the real world.</p>
          <p className="mt-3 text-white/70 max-w-[42ch]">Route, control and meter every vision request from one place.</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-5 sm:p-10">
        <motion.div
          className="w-full max-w-md"
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="lg:hidden flex justify-center mb-6">
            <LayertoLogo size={64} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6 rounded-l1 bg-card border border-line shadow-l2 p-6">{children}</div>
          {footer && <div className="mt-5 text-sm text-muted text-center">{footer}</div>}
          <div className="mt-6 flex justify-center">
            <ThemeToggle />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
