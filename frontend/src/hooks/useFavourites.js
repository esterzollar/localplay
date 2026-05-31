/**
 * useFavourites — localStorage-based favourites list
 *
 * Returns:
 *   favourites   Set<number>  — set of video IDs currently favourited
 *   isFav(id)    boolean
 *   toggleFav(id) void       — add or remove
 */
import { useState, useCallback } from 'react';

const KEY = 'localplay_favourites';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function save(set) {
  localStorage.setItem(KEY, JSON.stringify([...set]));
}

export function useFavourites() {
  const [favourites, setFavourites] = useState(load);

  const toggleFav = useCallback((id) => {
    setFavourites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(next);
      return next;
    });
  }, []);

  const isFav = useCallback((id) => favourites.has(id), [favourites]);

  return { favourites, isFav, toggleFav };
}
