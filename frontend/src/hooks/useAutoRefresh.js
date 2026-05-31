/**
 * useAutoRefresh(fetchFn, intervalMs, deps)
 *
 * Silently re-fetches data in the background on a timer.
 * - Never shows a loading spinner (backgroundUpdate pattern)
 * - Returns { data, refresh } so callers can also trigger manually
 * - Cleans up on unmount
 * - Pauses if the tab is hidden (Page Visibility API)
 *
 * Usage:
 *   const { data: playlists } = useAutoRefresh(client.getPlaylists, 5000);
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export function useAutoRefresh(fetchFn, intervalMs = 10_000, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);  // only true for the very first fetch
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async (isBackground = false) => {
    // Background fetches never set loading = true
    if (!isBackground) setLoading(true);
    try {
      const result = await fetchFn();
      if (mountedRef.current) setData(result);
    } catch (_) {
      // Swallow errors silently so background polls don't crash the UI
    } finally {
      if (!isBackground && mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;

    // First load — show loading indicator
    doFetch(false);

    // Set up background interval
    const schedule = () => {
      timerRef.current = setInterval(() => {
        // Skip if tab is hidden — saves bandwidth
        if (document.visibilityState === 'hidden') return;
        doFetch(true);
      }, intervalMs);
    };
    schedule();

    // Pause/resume on tab visibility
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        doFetch(true);   // immediate catch-up fetch when tab regains focus
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [doFetch, intervalMs]);

  // Expose a manual refresh trigger (e.g., after a POST)
  const refresh = useCallback(() => doFetch(true), [doFetch]);

  return { data, loading, refresh };
}
