import { useCallback, useEffect, useRef, useState } from "react";

export interface PollingState<T> {
  data: T | null;
  error: unknown;
  /** Replace the data now (e.g. from a POST response); in-flight polls are discarded. */
  replace: (next: T) => void;
}

/**
 * Calls fetcher every intervalMs while key is non-null (one request at a time).
 * Changing key restarts polling.
 */
export function usePolling<T>(key: string | null, fetcher: () => Promise<T>, intervalMs = 1500): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const fetcherRef = useRef(fetcher);
  const generation = useRef(0);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    let timer: number | undefined;

    const run = async () => {
      const started = generation.current;
      try {
        const next = await fetcherRef.current();
        if (!cancelled && started === generation.current) {
          setData(next);
          setError(null);
        }
      } catch (reason) {
        if (!cancelled) setError(reason);
      } finally {
        if (!cancelled) timer = window.setTimeout(run, intervalMs);
      }
    };

    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key, intervalMs]);

  const replace = useCallback((next: T) => {
    generation.current += 1;
    setData(next);
    setError(null);
  }, []);

  return { data, error, replace };
}
