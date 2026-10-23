/**
 * Formats a timestamp into a clean relative time string (e.g. "3 hours ago", "just now").
 * If the value is missing or invalid, returns "Never".
 */
export function formatRelativeTime(value?: string | null, now: Date = new Date()): string {
  if (!value) return 'Never';

  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return 'Never';

  const diffMs = now.getTime() - time;
  // If slightly in the future or within 45s, say "just now"
  if (diffMs < 45_000 && diffMs >= -10_000) {
    return 'just now';
  }

  const seconds = Math.floor(Math.abs(diffMs) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (minutes < 1) {
    return `${seconds} seconds ago`;
  }
  if (minutes === 1) {
    return '1 minute ago';
  }
  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }
  if (hours === 1) {
    return '1 hour ago';
  }
  if (hours < 24) {
    return `${hours} hours ago`;
  }
  if (days === 1) {
    return '1 day ago';
  }
  if (days < 30) {
    return `${days} days ago`;
  }
  if (months === 1) {
    return '1 month ago';
  }
  if (months < 12) {
    return `${months} months ago`;
  }
  if (years === 1) {
    return '1 year ago';
  }
  return `${years} years ago`;
}
