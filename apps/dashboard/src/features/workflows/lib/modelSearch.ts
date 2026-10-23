import type { PublicModelItem } from '@layerto/types';

/** Case-insensitive match on name, slug and description; every word must match. */
export function matchesModel(m: PublicModelItem, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${m.name} ${m.slug} ${m.description}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

export interface ModelSections {
  favorites: PublicModelItem[];
  recent: PublicModelItem[];
  others: PublicModelItem[];
}

/** Splits models into favourites, recently used and the rest (no duplicates), filtered by query. */
export function sectionModels(models: PublicModelItem[], query: string, favorites: string[], recent: string[]): ModelSections {
  const list = models.filter((m) => matchesModel(m, query));
  const fav = new Set(favorites);
  const bySlug = new Map(list.map((m) => [m.slug, m]));
  const favs = favorites.map((s) => bySlug.get(s)).filter((m): m is PublicModelItem => !!m);
  const rec = query ? [] : recent.filter((s) => !fav.has(s)).map((s) => bySlug.get(s)).filter((m): m is PublicModelItem => !!m);
  const used = new Set([...favs, ...rec].map((m) => m.slug));
  return { favorites: favs, recent: rec, others: list.filter((m) => !used.has(m.slug)) };
}
