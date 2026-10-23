export type ExpiryPreset = '7d' | '30d' | '90d' | '1y' | 'never' | 'custom';

/** Formats a Date object to YYYY-MM-DD using local timezone. */
export function formatLocalDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Tomorrow's date in local YYYY-MM-DD. */
export function getMinCustomDate(now = new Date()): string {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return formatLocalDateInput(tomorrow);
}

/** Today + 365 days in local YYYY-MM-DD. */
export function getMaxCustomDate(now = new Date()): string {
  const max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 365);
  return formatLocalDateInput(max);
}

/**
 * Converts a preset or custom date string to an RFC3339 ISO string or null.
 * For presets and custom dates, computes the end-of-day in the user's local timezone (23:59:59.999),
 * clamped to at most now + 365 days.
 */
export function computeExpiryDate(preset: ExpiryPreset, customDateStr?: string, now = new Date()): string | null {
  if (preset === 'never') return null;

  let targetDate: Date;
  if (preset === 'custom') {
    if (!customDateStr) return null;
    const parts = customDateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    const [year, month, day] = parts;
    targetDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  } else {
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : 365;
    targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59, 999);
  }

  // Ensure it does not exceed now + 365 days (max allowed by server)
  const maxTimestamp = now.getTime() + 365 * 24 * 60 * 60 * 1000;
  if (targetDate.getTime() > maxTimestamp) {
    return new Date(maxTimestamp).toISOString();
  }

  return targetDate.toISOString();
}

export const EXPIRY_OPTIONS: { value: ExpiryPreset; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days (recommended)' },
  { value: '1y', label: '1 year' },
  { value: 'custom', label: 'Custom date…' },
  { value: 'never', label: 'No expiration' },
];

/** Long, readable date and time for the "this key will expire…" line. */
export function formatExpiryLong(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
