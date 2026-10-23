import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, cn } from '@layerto/ui';
import type { IconName } from '@layerto/ui';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  group: string;
  run: () => void;
}

/** Ctrl/Cmd+K: jump to any page or start any action by typing. */
export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      setTimeout(() => input.current?.focus(), 10);
    }
  }, [open]);
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter((c) => words.every((w) => `${c.label} ${c.group} ${c.hint ?? ''}`.toLowerCase().includes(w))).slice(0, 12);
  }, [q, commands]);
  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            role="dialog"
            aria-label="Command menu"
            className="w-full max-w-xl overflow-hidden rounded-l2 border border-line bg-raised shadow-l3"
            initial={{ y: -12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Icon name="search" size={18} className="text-muted" />
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSel(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSel((s) => Math.min(results.length - 1, s + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSel((s) => Math.max(0, s - 1));
                  } else if (e.key === 'Enter') {
                    run(results[sel]);
                  } else if (e.key === 'Escape') {
                    onClose();
                  }
                }}
                placeholder="Go to a page or run an action…"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
                aria-label="Search commands"
              />
              <kbd className="rounded border border-line px-1.5 text-[11px] text-muted">Esc</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nothing matches.</li>}
              {results.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setSel(i)}
                    onClick={() => run(c)}
                    className={cn('w-full flex items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm cursor-pointer', i === sel ? 'bg-crimson-tint text-ink' : 'text-ink-secondary')}
                  >
                    <Icon name={c.icon} size={17} className={i === sel ? 'text-crimson' : 'text-muted'} />
                    <span className="flex-1">{c.label}</span>
                    <span className="text-[11px] text-muted">{c.hint ?? c.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
