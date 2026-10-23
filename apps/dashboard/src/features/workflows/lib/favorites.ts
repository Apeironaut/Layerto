/**
 * Favourite and recently used models, kept in this browser only (a per-viewer convenience).
 * Storage can be unavailable (private mode); every access is guarded.
 */
const FAV_KEY = 'layerto_fav_models';
const RECENT_KEY = 'layerto_recent_models';
const MAX_RECENT = 6;

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string').slice(0, 100) : [];
  } catch {
    return [];
  }
}

function write(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // storage unavailable: keep working without persistence
  }
}

export const loadFavorites = () => read(FAV_KEY);
export const saveFavorites = (list: string[]) => write(FAV_KEY, list);
export const loadRecent = () => read(RECENT_KEY);

export function addRecent(slug: string): string[] {
  const next = [slug, ...read(RECENT_KEY).filter((s) => s !== slug)].slice(0, MAX_RECENT);
  write(RECENT_KEY, next);
  return next;
}

export function toggleFavorite(list: string[], slug: string): string[] {
  return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
}
