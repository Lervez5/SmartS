'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useAuthStore, type User } from './store';
import type { Permission } from './permissions';
import { canAccessApp, type AppId } from './roles';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isResolving: boolean;
  permissions: Permission[];
  login: (user: User) => void;
  logout: () => void;
  /** Centralized authorization check. */
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
  canAll: (permissions: readonly Permission[]) => boolean;
  /** Whether this identity belongs in the given application. */
  canAccess: (app: AppId) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Bridges the auth store into React context so presentational components
 * (navbar, sidebar, auth forms) can read identity and permissions without
 * importing the store directly. The store selectors are always invoked so
 * the fallback below stays hook-order safe.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isResolving = useAuthStore((state) => state.isResolving);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const can = useAuthStore((state) => state.can);
  const canAny = useAuthStore((state) => state.canAny);
  const canAll = useAuthStore((state) => state.canAll);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isResolving,
      permissions: user?.permissions ?? [],
      login,
      logout,
      can,
      canAny,
      canAll,
      canAccess: (app: AppId) => canAccessApp(user?.role, app),
    }),
    [user, isAuthenticated, isResolving, login, logout, can, canAny, canAll]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isResolving = useAuthStore((state) => state.isResolving);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const can = useAuthStore((state) => state.can);
  const canAny = useAuthStore((state) => state.canAny);
  const canAll = useAuthStore((state) => state.canAll);

  return (
    ctx ?? {
      user,
      isAuthenticated,
      isResolving,
      permissions: user?.permissions ?? [],
      login,
      logout,
      can,
      canAny,
      canAll,
      canAccess: (app: AppId) => canAccessApp(user?.role, app),
    }
  );
}
