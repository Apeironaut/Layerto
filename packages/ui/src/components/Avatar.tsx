import { cn } from '../lib/cn';

const COLORS = ['from-rose-500 to-red-700', 'from-sky-500 to-blue-700', 'from-emerald-500 to-green-700', 'from-amber-500 to-orange-700',
  'from-violet-500 to-purple-700', 'from-cyan-500 to-teal-700', 'from-fuchsia-500 to-pink-700', 'from-lime-500 to-green-700'];

/** Initials avatar with a stable colour per name. */
export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const clean = (name || '?').replace(/^@/, '');
  let h = 0;
  for (const ch of clean) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  const text = ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br text-white font-bold', COLORS[h % COLORS.length], className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      aria-hidden="true"
    >
      {text}
    </span>
  );
}
