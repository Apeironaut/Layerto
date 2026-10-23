import { cn } from '../lib/cn';
import { passwordChecks, passwordStrength, STRENGTH_LABELS } from '../lib/passwordPolicy';
import { Icon } from './Icon';

export interface PasswordChecklistProps {
  password: string;
  username?: string;
  email?: string;
}

const BAR_COLOURS = ['bg-line-strong', 'bg-crimson', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'];

/** Live list of password rules with a strength bar. */
export function PasswordChecklist({ password, username, email }: PasswordChecklistProps) {
  const checks = passwordChecks(password, { username, email });
  const strength = passwordStrength(password, { username, email });
  return (
    <div className="mt-1 space-y-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex-1 grid grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn('h-1.5 rounded-pill transition-colors duration-300', i <= strength ? BAR_COLOURS[strength] : 'bg-line')} />
          ))}
        </div>
        <span className="text-xs font-semibold text-muted w-20 text-right">{password ? STRENGTH_LABELS[strength] : ''}</span>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {checks.map((c) => (
          <li key={c.id} className={cn('flex items-center gap-1.5 text-xs transition-colors', c.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted')}>
            <span className={cn('grid place-items-center h-4 w-4 rounded-full border', c.ok ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-line-strong')}>
              {c.ok && <Icon name="check" size={11} strokeWidth={3} />}
            </span>
            <span>
              {c.label}
              <span className="sr-only">{c.ok ? ' (done)' : ' (not yet)'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
