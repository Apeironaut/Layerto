/** API key status and expiry display, shared by the dashboard and the admin portal. */

export type KeyStatusVariant = 'active' | 'pending' | 'danger';

export interface KeyStatusInfo {
  label: string;
  variant: KeyStatusVariant;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

/** True when the key has an expiry and it has passed. */
export function isKeyExpired(expiresAt: string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  return !Number.isNaN(exp) && exp <= now.getTime();
}

/** True when the key expires within 7 days and hasn't expired yet. */
export function isKeyExpiringSoon(expiresAt: string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return false;
  return exp > now.getTime() && exp <= now.getTime() + 7 * DAY;
}

/** Revoked → Expired → Expires soon → Active. */
export function getKeyStatus(key: { revoked_at?: string | null; expires_at: string | null }, now = new Date()): KeyStatusInfo {
  if (key.revoked_at) return { label: 'Revoked', variant: 'danger' };
  if (isKeyExpired(key.expires_at, now)) return { label: 'Expired', variant: 'danger' };
  if (isKeyExpiringSoon(key.expires_at, now)) return { label: 'Expires soon', variant: 'pending' };
  return { label: 'Active', variant: 'active' };
}

/** "Oct 28, 2026, 11:59 PM", or "Never" when the key has no expiry. */
export function formatExpiryDisplay(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'Never';
  const d = new Date(expiresAt);
  return Number.isNaN(d.getTime())
    ? 'Never'
    : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function span(ms: number): string {
  if (ms >= DAY) {
    const d = Math.floor(ms / DAY);
    const h = Math.floor((ms % DAY) / HOUR);
    return h ? `${d}d ${h}h` : `${d}d`;
  }
  if (ms >= HOUR) {
    const h = Math.floor(ms / HOUR);
    const m = Math.floor((ms % HOUR) / MINUTE);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.max(1, Math.floor(ms / MINUTE))}m`;
}

/**
 * Live countdown for the expiry column: "6d 23h left", "3h 12m left", "8m left",
 * "Expired 2h ago", or "No expiry". Re-render with a ticking `now` to keep it current.
 */
export function timeLeft(expiresAt: string | null | undefined, now = new Date()): string {
  if (!expiresAt) return 'No expiry';
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (Number.isNaN(ms)) return 'No expiry';
  return ms > 0 ? `${span(ms)} left` : `Expired ${span(-ms)} ago`;
}
