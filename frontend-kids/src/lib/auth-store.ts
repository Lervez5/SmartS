import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
    id: string;
    email: string;
    role: "admin" | "parent" | "student" | "staff";
    name?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    login: (user: User) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            login: (user) => {
                set({ user, isAuthenticated: true });
            },
            logout: () => {
                set({ user: null, isAuthenticated: false });
            },
        }),
        {
            name: "sprout-auth",
        }
    )
);
