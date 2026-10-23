import { useCallback, useState } from 'react';
import { addRecent, loadFavorites, loadRecent, saveFavorites, toggleFavorite } from '../lib/favorites';

/** Favourite and recently used model slugs (this browser only). */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [recent, setRecent] = useState<string[]>(loadRecent);

  const toggle = useCallback((slug: string) => {
    setFavorites((list) => {
      const next = toggleFavorite(list, slug);
      saveFavorites(next);
      return next;
    });
  }, []);

  const markUsed = useCallback((slug: string) => setRecent(addRecent(slug)), []);

  return { favorites, recent, toggle, markUsed, isFavorite: (slug: string) => favorites.includes(slug) };
}
