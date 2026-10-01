import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from './roles';
import type { Permission } from './permissions';
import { normalizeRole } from './roles';

/**
 * The identity shape every application consumes.
 *
 * Tokens are never present here: the API issues them as httpOnly cookies, so
 * the browser cannot read them. Session truth lives on the server; this store
 * is a client-side mirror hydrated from GET /auth/me.
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  permissions: Permission[];
  appId: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** True while GET /auth/me is still resolving. */
  isResolving: boolean;
  login: (user: User) => void;
  /** Adopt an identity resolved from the API session cookie. */
  setSession: (user: User) => void;
  logout: () => void;
  clearSession: () => void;
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
  canAll: (permissions: readonly Permission[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isResolving: true,

      login: (user) => set({ user, isAuthenticated: true, isResolving: false }),

      setSession: (user) => set({ user, isAuthenticated: true, isResolving: false }),

      logout: () => set({ user: null, isAuthenticated: false, isResolving: false }),

      clearSession: () => set({ user: null, isAuthenticated: false, isResolving: false }),

      can: (permission) => {
        const { user } = get();
        return !!user?.permissions?.includes(permission);
      },
      canAny: (permissions) => {
        const granted = get().user?.permissions;
        if (!granted || granted.length === 0) return false;
        return permissions.some((p) => granted.includes(p));
      },
      canAll: (permissions) => {
        const granted = get().user?.permissions;
        if (!granted) return false;
        return permissions.every((p) => granted.includes(p));
      },
    }),
    {
      // Versioned: the identity shape changed (canonical role + permissions),
      // so caches written by an older build are discarded rather than
      // half-migrated into a user with an empty permission set.
      name: 'smarts-auth-storage',
      version: 2,
      // Rehydrate after mount rather than during render. The server has no
      // localStorage, so hydrating inline makes the first client render
      // disagree with the server markup and React discards the tree.
      skipHydration: true,
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // Snapshots from before version 2 are dropped outright: they carry a
      // legacy role and no permissions, which would silently hide every module.
      migrate: () => undefined,
      // Defence in depth for any surviving snapshot.
      onRehydrateStorage: () => (state) => {
        if (!state?.user) return;
        const role = normalizeRole(state.user.role as string);
        if (!role) {
          state.clearSession();
          return;
        }
        state.setSession({
          ...state.user,
          role,
          permissions: state.user.permissions ?? [],
        });
      },
    }
  )
);
