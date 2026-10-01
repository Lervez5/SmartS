'use client';

import { useEffect } from 'react';
import { useAuthStore, type User } from './store';
import type { UserRole } from './roles';
import type { Permission } from './permissions';
import { API_URL, type SessionResponse } from './client';
import { normalizeRole } from './roles';

/**
 * Renews an expired access token from the httpOnly refresh cookie and adopts
 * the identity it returns, so recovery needs a single round trip.
 *
 * The access token is short-lived by design. Without this, a session left open
 * past its expiry kept rendering a signed-in user from the persisted store
 * while every API call returned 401.
 */
let refreshInFlight: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  // Collapse concurrent refreshes so a burst of 401s triggers one renewal.
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return false;

        // The refresh response carries the current role and permissions, so
        // the store is repaired without a second /auth/me round trip.
        const data = (await res.json()) as SessionResponse;
        const user = toUser(data.user);
        if (user) {
          useAuthStore.getState().setSession(user);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

function toUser(raw: SessionResponse['user']): User | null {
  const role = normalizeRole(raw.role) as UserRole | null;
  if (!role) return null;
  return {
    id: raw.id,
    email: raw.email,
    role,
    name: raw.name,
    firstName: raw.firstName,
    lastName: raw.lastName,
    avatar: raw.avatar,
    permissions: (raw.permissions ?? []) as Permission[],
    appId: raw.appId,
  };
}

/**
 * Single session rehydration point for every application.
 *
 * The access token lives in an httpOnly cookie, so it cannot be read by the
 * client. That makes this the only way to learn who the user is after a
 * reload or in a fresh tab, and it is why all four apps must call it rather
 * than each inventing its own session logic.
 */
export function useSessionBootstrap(): { isResolving: boolean } {
  const isResolving = useAuthStore((state) => state.isResolving);

  useEffect(() => {
    // The store is global, so the identity write must not be tied to this
    // effect's lifecycle: React's development double-invoke cleans the first
    // pass up mid-flight, and a `cancelled` guard there discarded the renewed
    // session, leaving the shell signed out.
    let cancelled = false;

    async function readIdentity(): Promise<'ok' | 'expired' | 'none'> {
      const res = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return res.status === 401 ? 'expired' : 'none';

      const data = (await res.json()) as SessionResponse;
      const user = toUser(data.user);
      if (user) useAuthStore.getState().setSession(user);
      else useAuthStore.getState().clearSession();
      return user ? 'ok' : 'none';
    }

    async function resolve() {
      try {
        if ((await readIdentity()) !== 'expired') return;

        // The access token lapsed. Renew it, then read the identity again:
        // without the second read the store stays empty, every query stays
        // disabled, and the page looks signed out.
        if (!(await refreshSession())) {
          useAuthStore.getState().clearSession();
        }
      } catch {
        if (!(await refreshSession())) {
          useAuthStore.getState().clearSession();
        }
      }
    }

    resolve();

    return () => {
      cancelled = true;
      void cancelled;
    };
  }, []);

  return { isResolving };
}

/** Ends the server session and clears the client mirror. */
export async function endSession(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Best effort: the local session is cleared regardless.
  }
  document.cookie = 'userRole=; path=/; max-age=0';
  useAuthStore.getState().logout();
}
