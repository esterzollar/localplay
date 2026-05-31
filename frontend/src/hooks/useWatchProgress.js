/**
 * useWatchProgress — localStorage-based watch progress tracker
 *
 * Stores:  { [videoId]: seconds }
 * API:
 *   getProgress(id)         → number (0 if never watched)
 *   saveProgress(id, secs)  → void
 *   clearProgress(id)       → void  (call when video finishes)
 *   allProgress()           → { [id]: seconds }
 */
import { useState, useCallback } from 'react';

const KEY = 'localplay_watch_progress';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function persist(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function useWatchProgress() {
  const [progressMap, setProgressMap] = useState(load);

  const saveProgress = useCallback((id, seconds) => {
    setProgressMap(prev => {
      const next = { ...prev, [String(id)]: Math.floor(seconds) };
      persist(next);
      return next;
    });
  }, []);

  const clearProgress = useCallback((id) => {
    setProgressMap(prev => {
      const next = { ...prev };
      delete next[String(id)];
      persist(next);
      return next;
    });
  }, []);

  const getProgress = useCallback((id) => {
    return progressMap[String(id)] || 0;
  }, [progressMap]);

  return { progressMap, getProgress, saveProgress, clearProgress };
}

// ── Singleton helpers for components that don't need reactivity ──────────
export function getRawProgress(id) {
  try {
    const map = JSON.parse(localStorage.getItem(KEY) || '{}');
    return map[String(id)] || 0;
  } catch {
    return 0;
  }
}

export function saveRawProgress(id, seconds) {
  try {
    const map = JSON.parse(localStorage.getItem(KEY) || '{}');
    map[String(id)] = Math.floor(seconds);
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function clearRawProgress(id) {
  try {
    const map = JSON.parse(localStorage.getItem(KEY) || '{}');
    delete map[String(id)];
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

export function getAllProgress() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
