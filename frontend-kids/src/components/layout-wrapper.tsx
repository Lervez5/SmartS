"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Navbar } from "./navbar";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Define routes that should NOT have the global layout (sidebar/navbar)
    const authRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
    const isAuthRoute = authRoutes.includes(pathname);

    if (isAuthRoute) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-full overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[radial-gradient(at_top_right,_#f0fdf4_0%,_transparent_50%),radial-gradient(at_bottom_left,_#f0f9ff_0%,_transparent_50%)]">
                <Navbar />
                <main className="flex-1 overflow-y-auto p-8 relative">
                    {children}
                </main>
            </div>
        </div>
    );
}
