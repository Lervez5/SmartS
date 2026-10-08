"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useAuthStore, User } from "./store";

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Bridges the zustand auth store into React context so presentational
 * components (navbar, sidebar) can read auth state. The store hooks are
 * always called so the fallback below stays hook-order safe.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);

  const value = useMemo(
    () => ({ user, isAuthenticated, login, logout }),
    [user, isAuthenticated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  const storeUser = useAuthStore((state) => state.user);
  const storeIsAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const storeLogin = useAuthStore((state) => state.login);
  const storeLogout = useAuthStore((state) => state.logout);

  return (
    ctx ?? {
      user: storeUser,
      isAuthenticated: storeIsAuthenticated,
      login: storeLogin,
      logout: storeLogout,
    }
  );
}
