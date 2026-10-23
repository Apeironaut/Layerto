/**
 * Client copy of the server's password rules (services/core/internal/auth/policy.go),
 * for instant feedback. The server always re-checks.
 */
export interface PasswordCheck {
  id: 'length' | 'letter' | 'number' | 'symbol' | 'identity';
  label: string;
  ok: boolean;
}

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

export function passwordChecks(password: string, identity: { username?: string; email?: string } = {}): PasswordCheck[] {
  const chars = [...password];
  const lower = password.toLowerCase();
  const user = (identity.username ?? '').toLowerCase();
  const at = (identity.email ?? '').indexOf('@');
  const emailName = at >= 3 ? (identity.email ?? '').slice(0, at).toLowerCase() : '';
  const containsIdentity = (user.length >= 3 && lower.includes(user)) || (emailName !== '' && lower.includes(emailName));
  return [
    { id: 'length', label: `At least ${MIN_PASSWORD} characters`, ok: chars.length >= MIN_PASSWORD && password.length <= MAX_PASSWORD },
    { id: 'letter', label: 'A letter', ok: /\p{L}/u.test(password) },
    { id: 'number', label: 'A number', ok: /\p{Nd}/u.test(password) },
    { id: 'symbol', label: 'A symbol, like ! @ # ?', ok: chars.some((c) => !/[\p{L}\p{Nd}\s]/u.test(c)) },
    { id: 'identity', label: "Doesn't contain your username or email name", ok: password.length > 0 && !containsIdentity },
  ];
}

export function passwordValid(password: string, identity: { username?: string; email?: string } = {}): boolean {
  return passwordChecks(password, identity).every((c) => c.ok);
}

/** 0-4: a rough strength hint shown as a bar (rules met + length bonus). */
export function passwordStrength(password: string, identity: { username?: string; email?: string } = {}): number {
  if (!password) return 0;
  const met = passwordChecks(password, identity).filter((c) => c.ok).length;
  let score = met >= 5 ? 2 : met >= 3 ? 1 : 0;
  if (met >= 5 && password.length >= 12) score++;
  if (met >= 5 && password.length >= 16) score++;
  return Math.min(score, 4);
}

export const STRENGTH_LABELS = ['Too weak', 'Weak', 'Good', 'Strong', 'Very strong'] as const;
