"use client";

import React, { useEffect, useState } from "react";
import {
    Users,
    ShieldAlert,
    History as HistoryIcon,
    Search,
    MoreVertical,
    ChevronRight,
    UserPlus,
    Loader2
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Types mapping to the backend Prisma schema for User and AuditLog
 */
interface User {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: string;
}

interface AuditLog {
    id: string;
    userId: string | null;
    action: string;
    details: string;
    createdAt: string;
    user?: {
        name: string | null;
        email: string;
    };
}

export function AdminView() {
    const [users, setUsers] = useState<User[]>([]);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            try {
                // Fetching both Admin-protected endpoints
                const [usersRes, logsRes] = await Promise.all([
                    fetch("http://localhost:4000/api/users", { credentials: "include" }),
                    fetch("http://localhost:4000/api/audit-logs", { credentials: "include" })
                ]);

                if (!usersRes.ok || !logsRes.ok) {
                    throw new Error("Failed to fetch admin data. Check your permissions.");
                }

                const usersData = await usersRes.json();
                const logsData = await logsRes.json();

                if (mounted) {
                    setUsers(usersData.users);
                    setLogs(logsData.logs);
                    setIsLoading(false);
                }
            } catch (err: any) {
                if (mounted) {
                    setError(err.message);
                    setIsLoading(false);
                }
            }
        };

        fetchData();
        return () => { mounted = false; };
    }, []);

    const filteredUsers = users.filter((u) => {
        const query = searchQuery.toLowerCase();
        return (u.name?.toLowerCase() || "").includes(query) || u.email.toLowerCase().includes(query) || u.role.toLowerCase().includes(query);
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-xl shadow-primary/20 flex items-center justify-center animate-bounce">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <p className="text-slate-500 font-bold animate-pulse">Loading Secure Data...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto p-6 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl font-bold flex items-center gap-3">
                <ShieldAlert className="w-6 h-6" />
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Admin Command Center</h1>
                    <p className="text-muted-foreground">Manage users, monitor security, and review audit logs.</p>
                </div>
                <Link href="/admin/users/new" className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                    <UserPlus className="w-5 h-5" />
                    Add New User
                </Link>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[
                    { label: "Total Users", value: users.length.toString(), icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
                    { label: "Active Subs", value: "0", icon: ShieldAlert, color: "text-primary", bg: "bg-primary/10" },
                    { label: "Security Alerts", value: "0", icon: ShieldAlert, color: "text-green-600", bg: "bg-green-100" },
                    { label: "Audit Logs", value: logs.length.toString(), icon: HistoryIcon, color: "text-orange-600", bg: "bg-orange-100" },
                ].map((stat) => (
                    <div key={stat.label} className="glass p-6 rounded-3xl flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg)}>
                            <stat.icon className={cn("w-6 h-6", stat.color)} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                            <h4 className="text-2xl font-bold">{stat.value}</h4>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* User Management Table */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h3 className="text-xl font-bold">User Management</h3>
                        <div className="relative border border-slate-200/50 dark:border-slate-800 rounded-lg group focus-within:border-primary/40 bg-white/60 dark:bg-slate-900/60 shadow-sm transition-all overflow-hidden flex items-center w-full sm:w-64">
                            <Search className="absolute left-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent py-2 pl-9 pr-4 text-sm outline-none placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                    <div className="glass rounded-3xl overflow-hidden border border-slate-200/50 dark:border-slate-800 shadow-sm overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="bg-slate-50/80 dark:bg-slate-900/80 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-200/50 dark:border-slate-800">
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Joined</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-black text-slate-600 shadow-inner">
                                                    {(user.name || "U").charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{user.name || "Unknown User"}</p>
                                                    <p className="text-[11px] text-muted-foreground font-medium">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md",
                                                user.role === "admin" ? "bg-orange-100 text-orange-700 border-orange-200" :
                                                    user.role === "parent" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                                        user.role === "staff" ? "bg-purple-100 text-purple-700 border-purple-200" :
                                                            "bg-green-100 text-green-700 border-green-200"
                                            )}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-[11px] font-bold text-slate-500">
                                                {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-slate-400 hover:text-primary transition-colors hover:bg-white dark:hover:bg-slate-800 p-1.5 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-sm font-medium text-slate-500">
                                            No users found matching "{searchQuery}"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Audit Logs */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold">Audit History</h3>
                        <button className="text-primary text-xs font-black uppercase tracking-widest hover:underline">Full Report</button>
                    </div>
                    <div className="space-y-3">
                        {logs.slice(0, 5).map((log) => (
                            <div key={log.id} className="glass p-4 rounded-2xl space-y-2 relative group overflow-hidden border border-slate-200/50 dark:border-slate-800 hover:border-primary/30 transition-colors shadow-sm">
                                <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-primary transition-colors" />
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action}</h5>
                                        <p className="text-[10px] text-primary font-black uppercase tracking-wider">
                                            {log.user?.name || log.user?.email || "System"}
                                        </p>
                                    </div>
                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold">
                                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground font-medium line-clamp-2">{log.details}</p>
                                <button className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    View Details <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {logs.length === 0 && (
                            <div className="p-8 text-center text-sm font-medium text-slate-500 glass rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                No recent activity
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
