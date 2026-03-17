"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient, ApiError } from "@/lib/api-client";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/**
 * Generic data-fetching hook. Re-fetches whenever `path` or `params` change.
 * Pass `path = null` to skip the fetch (useful for conditional fetches).
 */
export function useApi<T>(
  path: string | null,
  params?: Record<string, string>,
): ApiState<T> & { refetch: () => void } {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: path !== null,
    error: null,
  });

  const paramsKey = params ? JSON.stringify(params) : "";
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const load = useCallback(async () => {
    if (!path) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiClient.get<T>(path, paramsRef.current);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err as ApiError });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, paramsKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
