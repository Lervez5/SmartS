"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Briefcase, Activity, ShieldAlert, Users, Loader2, BookOpen,
    Clock, CheckCircle, ChevronRight, ClipboardList, CalendarDays,
    GraduationCap, TrendingUp, AlertCircle, FileCheck, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTeacherDashboard } from "@/hooks/use-dashboard";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { useTodayClasses } from "@/hooks/use-attendance";

const stagger = { container: { animate: { transition: { staggerChildren: 0.07 } } }, item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } } };

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        pending:  "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
        graded:   "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
        submitted:"bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    };
    return (
        <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg", map[status] ?? "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
            {status}
        </span>
    );
}

export function TeacherView() {
    const { user } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (!user) return;
        if (user.role !== "teacher") {
            router.push(user.role === "student" ? "/dashboard/student" : (user.role === "super_admin" || user.role === "school_admin") ? "/admin" : "/parent");
        }
    }, [user, router]);

    const { data: dashboardData, isLoading, error } = useTeacherDashboard();
    const { data: todayClasses } = useTodayClasses();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-bold animate-pulse">Loading your workspace...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-2xl font-bold flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 shrink-0" />
                {error instanceof Error ? error.message : "Failed to load dashboard"}
            </div>
        );
    }

    const classesTaught    = dashboardData?.classesTaught    ?? [];
    const pendingGrading   = dashboardData?.pendingGrading   ?? [];
    const recentSubmissions = dashboardData?.recentSubmissions ?? [];
    const attendanceSummary = dashboardData?.attendanceSummary ?? [];

    const totalStudents  = classesTaught.reduce((a: number, c: any) => a + (c._count?.enrollments ?? 0), 0);
    const presentCount   = attendanceSummary.find((s: any) => s.status === "present")?._count ?? 0;
    const totalAttended  = attendanceSummary.reduce((a: number, s: any) => a + s._count, 0);
    const attendanceRate = totalAttended > 0 ? Math.round((presentCount / totalAttended) * 100) : 100;

    const greetingHour = new Date().getHours();
    const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";
    const firstName = user?.name?.split(" ")[0] ?? "Teacher";

    const stats = [
        { label: "Active Cohorts",    value: classesTaught.length,  icon: BookOpen,     color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-100 dark:bg-blue-900/30",    trend: null },
        { label: "Cohort Students",  value: totalStudents,          icon: GraduationCap,color: "text-primary",                        bg: "bg-primary/10",                       trend: null },
        { label: "Needs Grading",    value: pendingGrading.length,  icon: Clock,        color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-100 dark:bg-rose-900/30",    trend: pendingGrading.length > 0 ? "warn" : "ok" },
        { label: "Attendance Rate",  value: `${attendanceRate}%`,   icon: UserCheck,    color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", trend: attendanceRate >= 80 ? "ok" : "warn" },
    ];

    const quickActions = [
        { label: "Take Attendance",  desc: "Mark today's classes", href: "/dashboard/attendance", icon: ClipboardList, color: "from-emerald-500 to-teal-600" },
        { label: "View Calendar",    desc: "Schedule & events",    href: "/dashboard/calendar",   icon: CalendarDays,  color: "from-blue-500 to-indigo-600" },
    ];

    return (
        <div className="space-y-10 pb-20">

            {/* ── Header ── */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-bold text-primary mb-1">{greeting} 👋</p>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{firstName}'s Workspace</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-2xl text-sm font-bold">
                    <Activity className="w-4 h-4 animate-pulse" />
                    System Healthy
                </div>
            </header>

            {/* ── Stats Grid ── */}
            <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-4"
                variants={stagger.container} initial="initial" animate="animate">
                {stats.map((s, i) => (
                    <motion.div key={i} variants={stagger.item}
                        className="glass p-6 rounded-[2rem] border border-white/20 dark:border-white/10 flex items-center gap-4 relative overflow-hidden group hover:shadow-lg transition-shadow">
                        <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 blur-2xl"
                            style={{ background: i === 0 ? "#3b82f6" : i === 1 ? "#22c55e" : i === 2 ? "#ef4444" : "#22c55e" }} />
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", s.bg)}>
                            <s.icon className={cn("w-6 h-6", s.color)} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
                        </div>
                        {s.trend && (
                            <TrendingUp className={cn("w-4 h-4 absolute bottom-4 right-4 opacity-40", s.trend === "ok" ? "text-emerald-500" : "text-amber-500")} />
                        )}
                    </motion.div>
                ))}
            </motion.div>

            {/* ── Quick Actions ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {quickActions.map((a, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}>
                        <Link href={a.href}
                            className={cn("flex items-center gap-5 p-6 rounded-[2rem] bg-gradient-to-br text-white shadow-lg hover:scale-[1.02] active:scale-[0.99] transition-all", a.color)}>
                            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                                <a.icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-base">{a.label}</p>
                                <p className="text-white/70 text-xs font-medium mt-0.5">{a.desc}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 opacity-60" />
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* ── Main Content Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Today's Attendance Status */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="glass rounded-[2.5rem] p-8 border border-white/20 dark:border-white/10 space-y-5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-primary" /> Today's Cohort Sessions
                        </h3>
                        <Link href="/dashboard/attendance" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                            View all
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {!todayClasses || todayClasses.length === 0 ? (
                            <div className="py-8 text-center">
                                <CalendarDays className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                <p className="text-sm text-slate-400 font-medium">No classes today</p>
                            </div>
                        ) : todayClasses.slice(0, 4).map((cls: any) => (
                            <Link key={cls.id} href={`/dashboard/attendance/class/${cls.id}`}
                                className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-primary/30 transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-sm">
                                        {cls.name?.charAt(0) ?? "C"}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white leading-none">{cls.name}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">{cls.totalStudents} students</p>
                                    </div>
                                </div>
                                {cls.isSubmitted ? (
                                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">Pending</span>
                                )}
                            </Link>
                        ))}
                    </div>
                </motion.div>

                {/* Classes Taught */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="glass rounded-[2.5rem] p-8 border border-white/20 dark:border-white/10 space-y-5">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-blue-500" /> Managed Cohorts
                    </h3>
                    <div className="space-y-3">
                        {classesTaught.length === 0 ? (
                            <div className="py-8 text-center">
                                <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                <p className="text-sm text-slate-400 font-medium">No classes assigned yet</p>
                            </div>
                        ) : classesTaught.map((cls: any) => (
                            <div key={cls.id} className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-300/50 transition-all group cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center font-black text-blue-600 dark:text-blue-400 text-sm">
                                        {cls.name?.charAt(0) ?? "C"}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white leading-none">{cls.name}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">{cls.subject?.name} • {cls._count?.enrollments ?? 0} students</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Grading & Submissions */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="glass rounded-[2.5rem] p-8 border border-white/20 dark:border-white/10 space-y-6">

                    {/* Pending Grading */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-rose-500" /> Needs Grading
                        </h3>
                        {pendingGrading.length === 0 ? (
                            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">All caught up!</p>
                            </div>
                        ) : pendingGrading.slice(0, 3).map((sub: any) => (
                            <div key={sub.id} className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white leading-none">{sub.assignment?.title}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{sub.student?.name}</p>
                                </div>
                                <button className="text-[10px] font-black uppercase tracking-widest text-white bg-primary px-3 py-1.5 rounded-xl hover:scale-105 transition-transform shadow-sm shadow-primary/20 shrink-0">
                                    Grade
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <FileCheck className="w-5 h-5 text-primary" /> Recent Submissions
                        </h3>
                        {recentSubmissions.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-3">No recent submissions.</p>
                        ) : recentSubmissions.slice(0, 3).map((sub: any) => (
                            <div key={sub.id} className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-slate-800 dark:text-white leading-none truncate">{sub.assignment?.title}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{sub.student?.name}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {sub.score && (
                                        <span className="text-sm font-black text-slate-900 dark:text-white">{sub.score}%</span>
                                    )}
                                    <StatusBadge status={sub.status} />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
