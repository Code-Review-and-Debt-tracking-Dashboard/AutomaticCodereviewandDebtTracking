import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList, Dispatch, SetStateAction } from 'react';

import { getErrorMessage } from '../lib/errorMessage';

export interface AsyncData<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  load: (isRefresh?: boolean) => Promise<void>;
  setData: Dispatch<SetStateAction<T | null>>;
}

// loading/refreshing/error state for data screens. keeps old data on a failed refresh
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = [],
): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // stops double fetches
  const inFlight = useRef(false);
  // drop responses for old deps
  const generation = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const gen = generation.current;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      if (gen === generation.current) setData(result);
    } catch (err) {
      if (gen === generation.current) setError(getErrorMessage(err));
    } finally {
      if (gen === generation.current) {
        setLoading(false);
        setRefreshing(false);
        inFlight.current = false;
      }
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    inFlight.current = false;
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, refreshing, error, load, setData };
}
