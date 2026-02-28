"use client";

import React from "react";
import { Bell, Search, User } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

export function Navbar() {
    const { user, isAuthenticated } = useAuthStore();
    const router = useRouter();

    return (
        <header className="h-16 glass border-b border-white/20 dark:border-white/10 px-8 flex items-center justify-between sticky top-0 z-10 transition-colors">
            <div className="flex-1 max-w-md">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search for lessons..."
                        className="w-full bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800 focus:border-primary/30 focus:bg-white dark:focus:bg-slate-950 rounded-full py-2.5 pl-10 pr-4 text-sm outline-none transition-all shadow-sm text-foreground"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <ThemeToggle />
                <button className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/50 dark:hover:bg-slate-800 transition-colors">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
                </button>

                <div className="h-8 w-[1px] bg-border mx-2" />

                {isAuthenticated ? (
                    <button
                        onClick={() => router.push("/settings")}
                        className="flex items-center gap-3 group hover:bg-white/50 p-1 pr-3 rounded-full transition-all"
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-brand-light flex items-center justify-center text-white font-bold shadow-inner text-xl group-hover:shadow-lg overflow-hidden transition-all">
                            {user?.avatar ? (
                                <img src={user.avatar} alt={user.name || "User"} className="w-full h-full object-cover" />
                            ) : (
                                user?.name ? user.name[0] : <User className="w-6 h-6" />
                            )}
                        </div>
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{user?.name || "User"}</div>
                            <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{user?.role}</div>
                        </div>
                    </button>
                ) : (
                    <button
                        onClick={() => router.push("/login")}
                        className="bg-primary text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all"
                    >
                        Sign In
                    </button>
                )}
            </div>
        </header>
    );
}
