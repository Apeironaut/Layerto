import { Icon, Input, USERNAME_HINT } from '@layerto/ui';
import type { UsernameState } from '../hooks/useUsernameAvailability';

export interface UsernameFieldProps {
  value: string;
  onChange: (value: string) => void;
  state: UsernameState;
}

/** Username input with live availability feedback. */
export function UsernameField({ value, onChange, state }: UsernameFieldProps) {
  const error = state.status === 'invalid' || state.status === 'taken' ? state.message : null;
  const status =
    state.status === 'checking' ? (
      <span className="text-muted">Checking…</span>
    ) : state.status === 'available' ? (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
        <Icon name="check" size={14} /> Available
      </span>
    ) : state.status === 'unknown' ? (
      <span className="text-muted">Couldn't check right now. We'll check when you submit.</span>
    ) : (
      USERNAME_HINT
    );
  return (
    <Input
      label="Username"
      autoComplete="username"
      autoCapitalize="none"
      spellCheck={false}
      maxLength={30}
      required
      value={value}
      onChange={(e) => onChange(e.target.value.toLowerCase())}
      error={error}
      helperText={status}
    />
  );
}
