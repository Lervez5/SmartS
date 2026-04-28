"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    ClipboardList,
    CheckCircle2,
    Clock,
    AlertCircle,
    Users,
    ChevronRight,
    Loader2,
    CalendarDays,
    BookOpen,
} from "lucide-react";
import { useTodayClasses } from "@/hooks/use-attendance";
import { cn } from "@/lib/utils";

function formatTime(dateStr: string) {
    try {
        return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "—";
    }
}

export default function AttendanceDashboard() {
    const { data: classes, isLoading } = useTodayClasses();
    const today = new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const totalStudents = classes?.reduce((s, c) => s + c.totalStudents, 0) ?? 0;
    const submitted = classes?.filter(c => c.isSubmitted).length ?? 0;
    const pending = (classes?.length ?? 0) - submitted;

    return (
        <div className="space-y-10 pb-20">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <ClipboardList className="w-8 h-8 text-primary" />
                        Attendance
                    </h1>
                    <p className="text-muted-foreground mt-1 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        {today}
                    </p>
                </div>
                <Link
                    href="/dashboard/attendance/history"
                    className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                >
                    <Clock className="w-4 h-4 text-primary" />
                    View History
                </Link>
            </header>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                    { label: "Cohort Sessions", value: classes?.length ?? 0, icon: BookOpen, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
                    { label: "Submitted", value: submitted, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
                    { label: "Pending", value: pending, icon: AlertCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
                ].map((s, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="glass p-6 rounded-[2rem] border border-white/20 flex items-center gap-4"
                    >
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner", s.bg)}>
                            <s.icon className={cn("w-6 h-6", s.color)} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Class List */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white px-2 uppercase tracking-tight">Today's Sessions</h2>

                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : classes?.length === 0 ? (
                    <div className="glass rounded-[2.5rem] p-16 text-center border border-white/20">
                        <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No cohort sessions scheduled for today.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {classes?.map((cls, i) => {
                            const progress = cls.totalStudents > 0
                                ? Math.round((cls.markedCount / cls.totalStudents) * 100)
                                : 0;

                            return (
                                <motion.div
                                    key={cls.id}
                                    initial={{ opacity: 0, x: -16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 + i * 0.06 }}
                                >
                                    <Link
                                        href={`/dashboard/attendance/class/${cls.id}`}
                                        className="glass rounded-[2rem] p-6 border border-white/20 flex items-center justify-between gap-4 hover:border-primary/30 hover:shadow-lg transition-all group block"
                                    >
                                        <div className="flex items-center gap-5 flex-1 min-w-0">
                                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                                                <BookOpen className="w-7 h-7 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <h3 className="font-bold text-slate-900 dark:text-white">{cls.name}</h3>
                                                    <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg">
                                                        {cls.subject}
                                                    </span>
                                                    {cls.isSubmitted ? (
                                                        <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> Submitted
                                                        </span>
                                                    ) : cls.markedCount > 0 ? (
                                                        <span className="text-[10px] font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-lg">
                                                            Draft Saved
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {formatTime(cls.schedule)}
                                                    </span>
                                                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                                                        <Users className="w-3.5 h-3.5" />
                                                        {cls.totalStudents} students
                                                    </span>
                                                </div>
                                                {/* Progress bar */}
                                                <div className="mt-3 flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-primary transition-all duration-500"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-400 shrink-0">
                                                        {cls.markedCount}/{cls.totalStudents}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
