"use client";

import React, { useEffect, useState } from "react";
import { Briefcase, Activity, ShieldAlert, Users, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
    id: string;
    role: string;
}

interface Subject {
    id: string;
    name: string;
    _count?: { topics: number; lessons: number };
}

export default function StaffDashboardPage() {
    const [stats, setStats] = useState({ students: 0, contentQueue: 0 });
    const [recentSubjects, setRecentSubjects] = useState<Subject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetchStaffData = async () => {
            try {
                // Fetch users (to count active students)
                // Fetch subjects (to visualize the content queue)
                const [usersRes, subjectsRes] = await Promise.all([
                    fetch("http://localhost:4000/api/users", { credentials: "include" }),
                    fetch("http://localhost:4000/api/subjects", { credentials: "include" })
                ]);

                if (!usersRes.ok || !subjectsRes.ok) {
                    throw new Error("Failed to authenticate or fetch live data.");
                }

                const usersData = await usersRes.json();
                const subjectsData = await subjectsRes.json();

                if (mounted) {
                    const studentCount = usersData.users?.filter((u: User) => u.role === "student").length || 0;
                    const contentCount = subjectsData.subjects?.reduce((acc: number, sub: any) => acc + (sub._count?.lessons || 0), 0) || 0;

                    setStats({ students: studentCount, contentQueue: contentCount });
                    setRecentSubjects(subjectsData.subjects?.slice(0, 5) || []);
                    setIsLoading(false);
                }
            } catch (err: any) {
                if (mounted) {
                    setError(err.message);
                    setIsLoading(false);
                }
            }
        };

        fetchStaffData();

        return () => { mounted = false; };
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <p className="text-slate-500 font-bold animate-pulse">Loading Live Metrics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto p-6 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-2xl font-bold flex items-center gap-3">
                <ShieldAlert className="w-6 h-6" />
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-primary" />
                        Staff Command Center
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage content and support students effectively.</p>
                </div>
                <div className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-bold text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 animate-pulse" />
                    System Healthy
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: "Active Students", value: stats.students.toString(), icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
                    { label: "Content Queue", value: stats.contentQueue.toString(), icon: Briefcase, color: "text-primary", bg: "bg-green-100" },
                    { label: "Alerts", value: "0", icon: ShieldAlert, color: "text-rose-600", bg: "bg-rose-100" },
                    { label: "Uptime", value: "99.9%", icon: Activity, color: "text-amber-600", bg: "bg-amber-100" },
                ].map((stat, i) => (
                    <div key={i} className="glass p-6 rounded-[2rem] flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass rounded-[2.5rem] p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Recent Curriculum</h3>
                        <div className="relative border border-slate-200/50 dark:border-slate-800 rounded-lg group focus-within:border-primary/40 bg-white/60 dark:bg-slate-900/60 shadow-sm transition-all overflow-hidden flex items-center">
                            <Search className="absolute left-3 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search..."
                                disabled
                                className="w-full bg-transparent py-1.5 pl-9 pr-4 text-xs outline-none placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                    <div className="space-y-4">
                        {recentSubjects.length === 0 ? (
                            <div className="p-8 text-center text-sm font-medium text-slate-500 glass rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                No curriculum content found
                            </div>
                        ) : recentSubjects.map((sub, i) => (
                            <div key={sub.id} className="flex items-center justify-between p-4 bg-white/40 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded-2xl group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center font-bold text-primary shadow-inner">
                                        {sub.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{sub.name}</div>
                                        <div className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">
                                            {sub._count?.topics || 0} Topics • {sub._count?.lessons || 0} Lessons
                                        </div>
                                    </div>
                                </div>
                                <button className="text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    Review Base
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass rounded-[2.5rem] p-8">
                    <h3 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">Staff Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button className="h-24 glass rounded-3xl flex flex-col items-center justify-center gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all font-bold text-sm text-slate-600 border border-transparent shadow-sm">
                            <Users className="w-6 h-6" />
                            Verify Students
                        </button>
                        <button className="h-24 glass rounded-3xl flex flex-col items-center justify-center gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all font-bold text-sm text-slate-600 border border-transparent shadow-sm">
                            <Briefcase className="w-6 h-6" />
                            Edit Lessons
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
