/**
 * Shared React hooks used across the school platform.
 */

import { useCallback, useEffect, useState } from 'react';

export interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
}

/**
 * Generic data fetching hook for API endpoints.
 *
 * Exposes `refetch` so a screen that mutates through its own `fetch` call can
 * re-read the list afterwards, rather than duplicating the fetch logic to keep
 * two copies of the same data in step.
 */
export function useApi<T>(url: string | null, options?: UseApiOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    // A null url skips the request entirely, so a screen can gate a fetch on a
    // permission without pointing at an endpoint that would answer 403.
    if (url === null) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Captured in a local: TypeScript does not carry the null narrowing above
    // into the nested function below.
    const endpoint = url;

    let cancelled = false;
    const controller = new AbortController();

    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(endpoint, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = (await res.json()) as T;
        if (!cancelled) {
          setData(result);
          setError(null);
          options?.onSuccess?.(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          options?.onError?.(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // `options` is deliberately not a dependency: callers pass an inline
    // object, so including it would refetch on every render.
  }, [url, nonce]);

  return { data, loading, error, refetch };
}
