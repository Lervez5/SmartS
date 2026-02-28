"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    BookOpen,
    Trophy,
    LogOut,
    LogIn,
    CreditCard,
    ShieldCheck,
    FileText,
    UserCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";

const navigation = [
    { name: "Student Dashboard", href: "/dashboard/student", icon: LayoutDashboard, roles: ["student"] },
    { name: "Staff Dashboard", href: "/dashboard/staff", icon: LayoutDashboard, roles: ["staff", "admin"] },
    { name: "My Lessons", href: "/lessons", icon: BookOpen, roles: ["student"] },
    { name: "Achievements", href: "/badges", icon: Trophy, roles: ["student"] },
    { name: "Parent Portal", href: "/parent", icon: UserCircle, roles: ["parent"] },
    { name: "Subscriptions", href: "/parent/subscriptions", icon: CreditCard, roles: ["parent"] },
    { name: "Admin Center", href: "/admin", icon: ShieldCheck, roles: ["admin", "staff"] },
    { name: "Audit Logs", href: "/admin/logs", icon: FileText, roles: ["admin"] },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, isAuthenticated } = useAuthStore();

    const filteredNav = navigation.filter(item => {
        if (!isAuthenticated) return false;
        return item.roles.includes(user?.role || "");
    });

    const handleLogout = async () => {
        try {
            await fetch("http://localhost:4000/api/auth/logout", {
                method: "POST",
                credentials: "include"
            });
        } catch (err) {
            console.error("Logout fetch failed", err);
        }
        logout();
        router.push("/login");
    };

    return (
        <div className="flex flex-col h-full w-64 glass border-r border-white/20 dark:border-white/10">
            <div className="p-6">
                <Link href="/" className="flex items-center gap-2 font-bold text-2xl text-primary">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">S</div>
                    <span>SmartSprout</span>
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {filteredNav.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group",
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

            <div className="p-4 mt-auto border-t border-white/10">
                {isAuthenticated ? (
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:shadow-inner transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        Log Out
                    </button>
                ) : (
                    <button
                        onClick={() => router.push("/login")}
                        className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-sm font-bold text-primary hover:bg-primary/10 hover:shadow-inner transition-all"
                    >
                        <LogIn className="w-5 h-5" />
                        Sign In
                    </button>
                )}
            </div>
        </div>
    );
}
