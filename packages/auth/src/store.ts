import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  role: "super_admin" | "school_admin" | "teacher" | "parent" | "student";
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  permissions?: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  login: (user: User) => void;
  /** Adopt a user resolved from the API session cookie. */
  setSession: (user: User) => void;
  logout: () => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      login: (user) => set({ user, token: null, isAuthenticated: true }),
      setSession: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      clearSession: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'smarts-auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
