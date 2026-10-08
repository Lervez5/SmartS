'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from './store';
import { authClient } from './client';
import { endSession } from './session';
import { normalizeRole } from './roles';
import type { UserRole } from './roles';
import type { Permission } from './permissions';
import type { User } from './store';

/**
 * Kicks off session rehydration once per application.
 *
 * It deliberately does NOT withhold children. Access control belongs to the
 * server: middleware decides whether a route may be requested at all, and the
 * API authorizes every call independently. Blocking the tree here would leave
 * an unauthenticated visitor staring at a spinner on the very page they need
 * in order to sign in.
 *
 * Consumers that need a resolved identity (the sidebar, the navbar) read
 * `isResolving` from the store and render their own skeleton.
 */
export function AuthSessionGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Adopt any persisted identity first, so a returning user is not asked to
    // sign in again while the network call is in flight.
    useAuthStore.persist.rehydrate();

    if (useAuthStore.getState().isAuthenticated) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await authClient.me();
        if (cancelled) return;
        const user = normalizeSessionUser(data.user);
        if (user) useAuthStore.getState().setSession(user);
        else useAuthStore.getState().clearSession();
      } catch {
        if (!cancelled) useAuthStore.getState().clearSession();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}

function normalizeSessionUser(raw: {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: string;
  permissions?: string[];
  appId: string;
}): User | null {
  const role = normalizeRole(raw.role);
  if (!role) return null;
  return {
    id: raw.id,
    email: raw.email,
    role: role as UserRole,
    name: raw.name,
    firstName: raw.firstName,
    lastName: raw.lastName,
    avatar: raw.avatar,
    permissions: (raw.permissions ?? []) as Permission[],
    appId: raw.appId,
  };
}

/**
 * Ends the server session, clears the client mirror and returns the user to
 * this application's login screen. This is the single logout implementation;
 * no application should re-create it.
 */
export function useLogout(): () => Promise<void> {
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();

  return async function logoutAndRedirect() {
    await endSession();
    logout();
    router.push('/login');
  };
}
