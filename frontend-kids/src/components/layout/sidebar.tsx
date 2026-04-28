"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    BookOpen,
    Trophy,
    LogOut,
    CreditCard,
    ShieldCheck,
    FileText,
    UserCircle,
    ClipboardList,
    CalendarDays,
    Bell,
    Play,
    MessageCircle,
    Users,
    BarChart3,
    Layers,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";

const navigation = [
    { name: "Dashboard", href: "/dashboard/student", icon: LayoutDashboard, roles: ["student"] },
    { name: "Cohorts (Classes)", href: "/dashboard/student/courses", icon: BookOpen, roles: ["student"] },
    { name: "Class Sessions", href: "/dashboard/calendar", icon: CalendarDays, roles: ["student"] },
    { name: "Submissions", href: "/dashboard/student/submissions", icon: FileText, roles: ["student"] },
    { name: "Groups", href: "/dashboard/groups", icon: Users, roles: ["student"] },
    { name: "Community", href: "/dashboard/community", icon: MessageCircle, roles: ["student"] },
    { name: "Certificates", href: "/dashboard/certificates", icon: Trophy, roles: ["student"] },
    
    { name: "Teacher Station", href: "/dashboard/teacher", icon: LayoutDashboard, roles: ["teacher"] },
    { name: "Curriculum Architect", href: "/dashboard/teacher/courses", icon: BookOpen, roles: ["teacher"] },
    { name: "Attendance", href: "/dashboard/attendance", icon: ClipboardList, roles: ["teacher"] },
    { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays, roles: ["teacher"] },
    { name: "Reminders", href: "/dashboard/reminders", icon: Bell, roles: ["teacher"] },
    
    { name: "Parent Portal", href: "/parent", icon: UserCircle, roles: ["parent"] },
    { name: "Subscriptions", href: "/parent/subscriptions", icon: CreditCard, roles: ["parent"] },
    
    { name: "Admin Center", href: "/admin", icon: ShieldCheck, roles: ["super_admin", "school_admin"] },
    { name: "Cohort Manager", href: "/admin/cohorts", icon: Users, roles: ["super_admin", "school_admin"] },
    { name: "Platform Metrics", href: "/admin/metrics", icon: FileText, roles: ["super_admin", "school_admin"] },
    { name: "Audit Logs", href: "/admin/logs", icon: FileText, roles: ["super_admin", "school_admin"] },
    { name: "Platform Reports", href: "/admin/reporting", icon: BarChart3, roles: ["super_admin", "school_admin"] },
    { name: "Module Management", href: "/admin/modules", icon: Layers, roles: ["super_admin", "school_admin"] },
    { name: "Timetable Import", href: "/admin/timetable/bulk", icon: CalendarDays, roles: ["super_admin", "school_admin"] },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, isAuthenticated } = useAuthStore();

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

    const filteredNav = navigation.filter(item => {
        if (!isAuthenticated) return false;
        return item.roles.includes(user?.role || "");
    });


    return (
        <div className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 lg:sticky lg:top-0 lg:inset-y-auto lg:h-screen transition-all duration-300 transform",
            "glass border-r border-white/20 dark:border-white/10 flex flex-col bg-white dark:bg-slate-950 lg:bg-transparent",
            isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
            <div className="p-5 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
                    <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 text-xs">S</div>
                    <span className="dark:text-white">SmartSprout</span>
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
                {isAuthenticated && (
                    <button
                        onClick={handleLogout}
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
