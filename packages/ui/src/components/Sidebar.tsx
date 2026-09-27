"use client";

import React from "react";
import Link from "next/link";
import { LogOut, X, LucideIcon } from "lucide-react";
import { cn } from "@schoolos/utils";
import { useAuth } from "@schoolos/auth";

export interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  navigation: NavItem[];
  pathname?: string;
  onLogout?: () => void;
  brandName?: string;
  brandIcon?: string;
}

export function Sidebar({
  isOpen = false,
  onClose,
  navigation,
  pathname = "",
  onLogout,
  brandName = "School OS",
  brandIcon = "S",
}: SidebarProps) {
  const { user, isAuthenticated } = useAuth();
  const userRole = user?.role ?? "";

  const filteredNav = navigation.filter((item) => {
    if (!isAuthenticated) return false;
    return item.roles.includes(userRole);
  });

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 lg:sticky lg:top-0 lg:inset-y-auto lg:h-screen transition-all duration-300 transform",
        "glass border-r border-white/20 dark:border-white/10 flex flex-col bg-white dark:bg-slate-950 lg:bg-transparent",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      <div className="p-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 text-xs">
            {brandIcon}
          </div>
          <span className="dark:text-white">{brandName}</span>
        </Link>
        <button
          onClick={onClose}
          className="p-2 -mr-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors"
        >
          <X className="w-6 h-6 text-slate-500" />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto py-4">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 group",
                isActive
                  ? "bg-gradient-to-r from-primary to-blue-500 text-white shadow-lg shadow-primary/20"
                  : "text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800/60 hover:text-primary hover:shadow-sm"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "group-hover:text-primary")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50">
        {isAuthenticated && onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-sm font-bold text-slate-500 hover:bg-destructive/10 hover:text-destructive hover:shadow-inner transition-all group"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Log Out
          </button>
        )}
      </div>
    </div>
  );
}