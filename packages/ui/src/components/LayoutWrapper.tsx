"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Navbar, NavbarProps } from "./Navbar";
import { Sidebar, SidebarProps } from "./Sidebar";
import { roleNavigation } from "./navigation";

export interface LayoutWrapperProps {
  children: React.ReactNode;
  navbarProps?: Omit<NavbarProps, "onMenuClick" | "user" | "isAuthenticated">;
  sidebarProps?: Omit<SidebarProps, "isOpen" | "onClose" | "pathname" | "navigation" | "isAuthenticated" | "userRole" | "onLogout">;
  /** Role used to resolve the sidebar navigation inside this client component. */
  role?: string;
  authRoutes?: string[];
  showLayout?: boolean;
}

export function LayoutWrapper({
  children,
  navbarProps,
  sidebarProps,
  role,
  authRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"],
  showLayout = true,
}: LayoutWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isAuthRoute = authRoutes.includes(pathname);

  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // best-effort: clear the client session regardless
    }
    document.cookie = "userRole=; path=/; max-age=0";
    window.localStorage.removeItem("smarts-auth-storage");
    window.location.href = "/login";
  }, [router]);

  if (!showLayout || isAuthRoute) {
    return <>{children}</>;
  }

  const navigation = role ? roleNavigation[role] ?? [] : [];

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Sidebar with mobile responsiveness */}
      <Sidebar
        {...sidebarProps}
        navigation={navigation}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        pathname={pathname}
        onLogout={handleLogout}
      />

      {/* Backdrop for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[radial-gradient(at_top_right,_#f0fdf4_0%,_transparent_50%),radial-gradient(at_bottom_left,_#f0f9ff_0%,_transparent_50%)] dark:bg-none dark:bg-slate-950">
        <Navbar
          {...navbarProps}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 lg:pl-6 relative">{children}</main>
      </div>
    </div>
  );
}
