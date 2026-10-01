/**
 * Shared React hooks used across the school platform.
 */

import { useEffect, useState } from 'react';

export interface UseApiOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: unknown) => void;
}

/**
 * Generic data fetching hook for API endpoints.
 */
export function useApi<T>(url: string, options?: UseApiOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(url, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = (await res.json()) as T;
        if (!cancelled) {
          setData(result);
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
  }, [url]);

  return { data, loading, error };
}
