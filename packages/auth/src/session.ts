"use client";

import { useEffect } from "react";
import { useAuthStore } from "./store";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/**
 * Rehydrates the auth store from the httpOnly access-token cookie.
 *
 * The token is not readable by JS, so the persisted zustand state is only a
 * cache. On a fresh tab (or after the cookie is set in another tab) the store
 * would otherwise look logged out even though the API session is still valid.
 */
export function useSessionBootstrap(): { isLoading: boolean; user: ReturnType<typeof useAuthStore.getState>["user"] } {
  const { user, isAuthenticated, setSession, clearSession } = useAuthStore();
  const isLoading = !isAuthenticated;

  useEffect(() => {
    let cancelled = false;

    async function resolveSession() {
      try {
        const res = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (data?.user) setSession(data.user);
          else clearSession();
        } else {
          clearSession();
        }
      } catch {
        // API unreachable: keep whatever the persisted store had.
        if (!cancelled) clearSession();
      }
    }

    resolveSession();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setSession, clearSession]);

  return { isLoading, user };
}
