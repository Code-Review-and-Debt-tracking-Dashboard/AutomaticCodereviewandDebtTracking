import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList, Dispatch, SetStateAction } from 'react';

import { getErrorMessage } from '../lib/errorMessage';

export interface AsyncData<T> {
  data: T | null;
  /** Initial load or retry — screens show a full-screen spinner. */
  loading: boolean;
  /** Pull-to-refresh — screens keep showing the current data. */
  refreshing: boolean;
  error: string | null;
  load: (isRefresh?: boolean) => Promise<void>;
  setData: Dispatch<SetStateAction<T | null>>;
}

/**
 * Owns the loading / refreshing / error state machine shared by the data
 * screens. The fetch itself stays in the screen, so each one can keep its own
 * request shape (fan-out, allSettled, single GET).
 *
 * On a failed refresh the previous data is kept, so screens can show a compact
 * error banner over stale content instead of blanking out.
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = [],
): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Latest-ref so screens can pass an inline closure without it going stale.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Guards a refresh fired during the initial load, and double-tapped Retry.
  const inFlight = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (inFlight.current) return;
    inFlight.current = true;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      setData(await fetcherRef.current());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, refreshing, error, load, setData };
}
