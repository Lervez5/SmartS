"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, Search, User, Menu, LogOut, Settings, ChevronDown } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@schoolos/auth";
import { cn } from "@schoolos/utils";

export interface NavbarProps {
  onMenuClick?: () => void;
  onLogout?: () => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
}

export function Navbar({
  onMenuClick,
  onLogout,
  searchPlaceholder = "Search...",
  showSearch = true,
}: NavbarProps) {
  const { user, isAuthenticated } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <header className="h-16 glass border-b border-white/20 dark:border-white/10 px-4 md:px-8 flex items-center justify-between sticky top-0 z-10 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        {/* Mobile Menu Toggle */}
        <button
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="p-2 -ml-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-800 lg:hidden transition-colors"
        >
          <Menu className="w-6 h-6 text-slate-600 dark:text-slate-300" />
        </button>

        {showSearch && (
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="w-full bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800 focus:border-primary/30 focus:bg-white dark:focus:bg-slate-950 rounded-full py-2 pl-10 pr-4 text-sm outline-none transition-all shadow-sm text-foreground"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <ThemeToggle />
        <button
          aria-label="Notifications"
          className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/50 dark:hover:bg-slate-800 transition-colors"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
        </button>

        <div className="h-8 w-[1px] bg-border mx-2 hidden sm:block" />

        {isAuthenticated && user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              className="flex items-center gap-2 md:gap-3 group hover:bg-white/50 p-1 md:pr-3 rounded-full transition-all"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-primary to-brand-light flex items-center justify-center text-white font-bold shadow-inner text-lg md:text-xl group-hover:shadow-lg overflow-hidden transition-all">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name || "User"} className="w-full h-full object-cover" />
                ) : (
                  user.name ? user.name[0] : <User className="w-5 h-5 md:w-6 md:h-6" />
                )}
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs md:text-sm font-bold text-slate-900 group-hover:text-primary transition-colors dark:text-white">
                  {user.name || "User"}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                  {user.role}
                </div>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform hidden sm:block", isMenuOpen && "rotate-180")} />
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-3 w-64 glass rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden z-50"
              >
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="font-bold text-slate-900 dark:text-white truncate">{user.name || "User"}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>

                <div className="p-2">
                  <Link
                    href="/settings"
                    onClick={() => setIsMenuOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Account Settings
                  </Link>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogout?.();
                    }}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="bg-primary text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.05] active:scale-[0.95] transition-all whitespace-nowrap"
          >
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
