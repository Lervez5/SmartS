"use client";

import React, { useEffect, useState } from "react";
import {
    Users,
    ShieldAlert,
    History as HistoryIcon,
    Search,
    MoreVertical,
    UserPlus,
    Loader2,
    Upload,
    Activity,
    ShieldCheck,
    Lock,
    ChevronRight,
    ExternalLink,
    X,
    KeyRound,
    UserX,
    UserCheck,
    Trash2,
    BookOpen,
    Sparkles
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";
import { useAdminDashboard } from "@/hooks/use-dashboard";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface User {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: string;
    isActive: boolean;
    invitationStatus: string;
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
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const { data: dashboardData, isLoading, error, refetch } = useAdminDashboard();
    const { user } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (!user) return;
        if (user.role !== "super_admin" && user.role !== "school_admin") {
            router.push(user.role === "student" ? "/dashboard/student" : user.role === "parent" ? "/parent" : "/dashboard/teacher");
        }
    }, [user, router]);

    const users = (dashboardData?.recentUsers || []) as User[];
    const logs = (dashboardData?.activity || []) as AuditLog[];

    const filteredUsers = users.filter((u) => {
        const query = searchQuery.toLowerCase();
        return (u.name?.toLowerCase() || "").includes(query) || u.email.toLowerCase().includes(query) || u.role.toLowerCase().includes(query);
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-slate-500 font-bold tracking-widest text-xs uppercase animate-pulse">Initializing Dashboard...</p>
            </div>
        );
    }

    const totalUsersCount = dashboardData?.stats?.reduce((acc: number, curr: any) => acc + curr._count, 0) || 0;
    const revenueCents = dashboardData?.revenue?._sum?.amountCents || 0;

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-10 relative">
            {/* Header Section */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                        Admin Command Center
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage global users, provision access, and monitor system security.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link 
                        href="/admin/users/bulk"
                        className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm group"
                    >
                        <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform text-primary" />
                        Bulk Import
                    </Link>
                    <Link href="/admin/users/new" className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                        <UserPlus className="w-4 h-4" />
                        Provision User
                    </Link>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                {[
                    { label: "Total Users", value: totalUsersCount, icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
                    { label: "Revenue", value: `$${(revenueCents / 100).toFixed(2)}`, icon: Activity, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-green-100 dark:bg-emerald-900/30" },
                    { label: "System Health", value: "Optimal", icon: ShieldCheck, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
                    { label: "Recent Activity", value: logs.length, icon: HistoryIcon, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
                ].map((stat, i) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="glass p-6 rounded-[2rem] border border-white/20 flex items-center gap-4 group hover:scale-[1.02] transition-all"
                    >
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", stat.bg)}>
                            <stat.icon className={cn("w-6 h-6", stat.color)} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="space-y-8 relative z-10">
                {/* Course Portfolio Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Course Portfolio
                        </h3>
                        <Link href="/dashboard/teacher/courses/new" className="text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5 px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
                            Deploy New Course
                        </Link>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 glass p-8 rounded-[2.5rem] border border-white/20 space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-bold">Active Courses</h4>
                                <p className="text-3xl font-black mt-2">{dashboardData?.courseCount || 0}</p>
                                <p className="text-xs text-slate-500 mt-1 font-medium">
                                    {dashboardData?.courseCount ? "Courses are live and accessible." : "No courses have been registered yet."}
                                </p>
                            </div>
                        </div>
                        
                        <div className="md:col-span-2 glass p-8 rounded-[2.5rem] border border-white/20 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/30 dark:bg-slate-900/30 border-dashed">
                            {(dashboardData?.courseCount || 0) > 0 ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-emerald-500/10 rounded-full shadow-inner mx-auto w-16 h-16 flex items-center justify-center">
                                        <ShieldCheck className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-slate-900 dark:text-white">System Curriculum Active</h5>
                                        <p className="text-xs text-slate-500 max-w-xs mx-auto">Platform learning modules are synchronized. You can monitor individual student progress in the Metrics section.</p>
                                    </div>
                                    <Link href="/admin/metrics" className="inline-block text-xs font-black uppercase tracking-widest text-primary hover:underline">
                                        View Deep Analytics
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-inner">
                                        <Sparkles className="w-8 h-8 text-primary/40" />
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-slate-400">Curriculum Engine Empty</h5>
                                        <p className="text-xs text-slate-500 max-w-xs mx-auto">The platform's learning modules are currently offline. Start by creating a course to populate the student library.</p>
                                    </div>
                                    <Link 
                                        href="/dashboard/teacher/courses/new"
                                        className="bg-primary text-white px-6 py-2.5 rounded-2xl font-bold text-xs shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                                    >
                                        Initialize Curriculum
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Directory Section - Full Width */}
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            User Directory
                        </h3>
                        <div className="relative border border-slate-200/50 dark:border-slate-800 rounded-xl group focus-within:border-primary/40 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md shadow-sm transition-all overflow-hidden flex items-center w-full sm:w-64">
                            <Search className="absolute left-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search directory..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent py-2.5 pl-9 pr-4 text-xs outline-none placeholder:text-slate-500 font-bold text-slate-900 dark:text-white"
                            />
                        </div>
                    </div>
                    
                    <div className="glass rounded-[2.5rem] overflow-hidden border border-white/20 shadow-xl overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-950/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100/50 dark:border-slate-800/50">
                                    <th className="px-8 py-5">Identity</th>
                                    <th className="px-8 py-5">Role</th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                                    {filteredUsers.map((u) => (
                                        <tr 
                                            key={u.id} 
                                            className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors group cursor-default"
                                        >
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center font-black text-slate-500 shadow-inner">
                                                        {(u.name || u.email).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{u.name || "N/A"}</p>
                                                        <p className="text-[11px] text-slate-500 font-medium">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className={cn(
                                                    "text-[10px] font-bold capitalize px-2.5 py-1 rounded-lg border",
                                                    u.role.includes("admin") ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" : 
                                                    "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                                )}>
                                                    {u.role.replace("_", " ")}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-2 h-2 rounded-full", u.isActive ? "bg-green-500" : "bg-amber-500")} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                        {u.isActive ? "Live" : "Pending"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <button 
                                                    onClick={() => setSelectedUser(u)}
                                                    className="p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-primary transition-colors"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-16 text-center text-slate-400 text-sm font-medium italic">
                                            No system records found matching your query.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>



                {/* Security Matrix - Wide Visual Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 p-8 bg-slate-900 rounded-[2.5rem] text-white space-y-6 border border-slate-800 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                                    <ShieldCheck className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">Security Matrix</h4>
                                    <p className="text-xs text-slate-400">Encryption layer active.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-xs font-black uppercase tracking-widest text-green-500">Node Secure</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 relative z-10 pt-4">
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Access Nodes</p>
                                <p className="text-xl font-black mt-1">12 <span className="text-xs text-emerald-400 font-bold">Online</span></p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Encryption</p>
                                <p className="text-xl font-black mt-1">AES-256</p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Threats Blocked</p>
                                <p className="text-xl font-black mt-1">0 <span className="text-xs text-slate-500 font-bold">Today</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Scan - Interactive Panel */}
                    <div className="p-8 bg-primary rounded-[2.5rem] text-white flex flex-col justify-between border border-primary-dark shadow-2xl relative overflow-hidden">
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-y-1/4 translate-x-1/4 pointer-events-none" />
                        <div>
                            <h4 className="font-bold text-lg flex items-center gap-2">
                                <Activity className="w-5 h-5" />
                                Quick Scan
                            </h4>
                            <p className="text-xs text-white/70 mt-2 font-medium leading-relaxed">
                                Initiate a deep system scan to verify permissions, token integrity, and identify dormant accounts.
                            </p>
                        </div>
                        <button className="w-full bg-white text-primary py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl mt-6 relative z-10">
                            Run Diagnostics
                        </button>
                    </div>
                </div>

                {/* Sidebar Logs -> Full Width Logs */}
                <div className="space-y-6 pt-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Recent Logs
                        </h3>
                        <Link href="/admin/logs" className="text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5 px-4 py-2 rounded-xl transition-colors flex items-center gap-2">
                            Full Report <ExternalLink className="w-4 h-4" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                        {logs.length === 0 ? (
                            <div className="glass p-8 rounded-2xl border border-white/20 flex flex-col items-center justify-center text-center space-y-3 shadow-inner">
                                <HistoryIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">System stream is currently quiet.<br/>No recent activity to report.</p>
                            </div>
                        ) : (
                            logs.slice(0, 5).map((log, i) => (
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + (i * 0.05) }}
                                    key={log.id} 
                                    className="glass p-4 rounded-2xl border border-white/20 hover:border-primary/30 transition-all group"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="space-y-0.5">
                                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-white">{log.action}</h5>
                                            <p className="text-[10px] text-primary font-bold truncate max-w-[150px]">
                                                @{log.user?.name || log.user?.email || "system"}
                                            </p>
                                        </div>
                                        <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-slate-500 font-bold">
                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">{log.details}</p>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* User Action Modal rendered via Portal to escape stacking context */}
            <Portal>
                <AnimatePresence>
                    {selectedUser && (
                        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setSelectedUser(null)}
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            />
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                            >
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center font-black text-xl text-primary shadow-inner">
                                            {(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedUser.name || "N/A"}</h3>
                                            <p className="text-sm text-slate-500 font-medium">{selectedUser.email}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedUser(null)}
                                        className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Role</p>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 capitalize">{selectedUser.role.replace("_", " ")}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={cn("w-2 h-2 rounded-full", selectedUser.isActive ? "bg-green-500" : "bg-amber-500")} />
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                {selectedUser.isActive ? "Live" : "Pending"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Account Actions</h4>
                                    
                                    <button className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-primary/50 hover:bg-primary/5 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <KeyRound className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Reset Token</p>
                                                <p className="text-[10px] text-slate-500 font-medium">Issue new access credentials</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                    </button>

                                    <button className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between group hover:border-amber-500/50 hover:bg-amber-500/5 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                {selectedUser.isActive ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                    {selectedUser.isActive ? "Suspend Node" : "Activate Node"}
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-medium">Toggle system access layer</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                                    </button>

                                    <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                                        <button className="w-full p-4 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center gap-2 font-bold text-sm hover:bg-destructive hover:text-white transition-colors group">
                                            <Trash2 className="w-4 h-4" />
                                            Terminate Account
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                    )}
                </AnimatePresence>
            </Portal>
        </div>
    );
}
