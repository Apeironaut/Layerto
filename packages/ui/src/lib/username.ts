/** Client copy of the server's username rules. */
export const USERNAME_HINT = '3-30 characters: lowercase letters, numbers, dots or underscores.';

const PATTERN = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Returns a problem to show, or null when the shape is valid (availability is checked by the server). */
export function usernameProblem(value: string): string | null {
  const u = normalizeUsername(value);
  if (u.length < 3) return 'At least 3 characters.';
  if (u.length > 30) return 'At most 30 characters.';
  if (!PATTERN.test(u)) return 'Use lowercase letters, numbers, dots or underscores, starting and ending with a letter or number.';
  if (u.includes('..')) return "Dots can't be next to each other.";
  return null;
}
