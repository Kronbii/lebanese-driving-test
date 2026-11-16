import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";
import { isAbort } from "./errors";

export interface ApiGetState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
  setData: (update: (current: T | null) => T | null) => void;
}

/** GETs /api<path> whenever path changes. Pass null to skip. */
export function useApiGet<T>(path: string | null): ApiGetState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<T>(path, { signal: controller.signal })
      .then((result) => {
        setDataState(result);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || isAbort(reason)) return;
        setError(reason);
        setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const setData = useCallback(
    (update: (current: T | null) => T | null) => setDataState((current) => update(current)),
    []
  );

  return { data, error, loading, reload, setData };
}
