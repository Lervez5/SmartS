"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
    ClipboardList, TrendingUp, AlertCircle, CheckCircle2,
    Clock, CalendarDays, BookOpen, Loader2,
} from "lucide-react";
import { useMyAttendance } from "@/hooks/use-attendance";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
    present:  { label: "Present",  color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    absent:   { label: "Absent",   color: "text-red-600 dark:text-red-400",         bg: "bg-red-100 dark:bg-red-900/30" },
    late:     { label: "Late",     color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-100 dark:bg-amber-900/30" },
    excused:  { label: "Excused",  color: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-100 dark:bg-blue-900/30" },
    sick:     { label: "Sick",     color: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-100 dark:bg-purple-900/30" },
    on_leave: { label: "On Leave", color: "text-slate-500 dark:text-slate-400",     bg: "bg-slate-100 dark:bg-slate-800" },
};

function AttendanceRing({ percentage }: { percentage: number }) {
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const color = percentage >= 80 ? "#22c55e" : percentage >= 60 ? "#f59e0b" : "#ef4444";

    return (
        <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100 dark:text-slate-800" />
                <circle
                    cx="80" cy="80" r={radius}
                    fill="none" stroke={color} strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-1000"
                />
            </svg>
            <div className="text-center">
                <p className="text-3xl font-black text-slate-900 dark:text-white">{percentage}%</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Attendance</p>
            </div>
        </div>
    );
}

export default function MyAttendancePage() {
    const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
    const { data, isLoading } = useMyAttendance(dateRange.startDate ? dateRange : undefined);

    const stats = data?.stats;
    const records = data?.records ?? [];

    // Group records by month for breakdown
    const byMonth: Record<string, typeof records> = {};
    for (const r of records) {
        const month = new Date(r.date).toLocaleDateString("en-US", { year: "numeric", month: "long" });
        if (!byMonth[month]) byMonth[month] = [];
        byMonth[month].push(r);
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-16">
            {/* Header */}
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <ClipboardList className="w-8 h-8 text-primary" />
                    My Attendance
                </h1>
                <p className="text-muted-foreground mt-1">Track your class participation and history.</p>
            </header>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Percentage Ring */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass rounded-[2.5rem] p-8 border border-white/20 flex flex-col items-center justify-center gap-4"
                        >
                            <AttendanceRing percentage={stats?.percentage ?? 100} />
                            <p className="text-xs text-muted-foreground font-medium">
                                {stats?.present ?? 0} present out of {stats?.total ?? 0} classes
                            </p>
                        </motion.div>

                        {/* Quick Stats */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="md:col-span-2 grid grid-cols-2 gap-4"
                        >
                            {[
                                { label: "Present", value: stats?.present ?? 0, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
                                { label: "Absent", value: stats?.absent ?? 0, icon: AlertCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
                                { label: "Late", value: records.filter(r => r.status === "late").length, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
                                { label: "Total Classes", value: stats?.total ?? 0, icon: BookOpen, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
                            ].map((s, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 + i * 0.07 }}
                                    className="glass p-5 rounded-[1.75rem] border border-white/20 flex items-center gap-3"
                                >
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.bg)}>
                                        <s.icon className={cn("w-5 h-5", s.color)} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                                        <p className="text-xl font-black text-slate-900 dark:text-white">{s.value}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>

                    {/* Date Filter */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">From</label>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={e => setDateRange(p => ({ ...p, startDate: e.target.value }))}
                                className="bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">To</label>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={e => setDateRange(p => ({ ...p, endDate: e.target.value }))}
                                className="bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/60"
                            />
                        </div>
                        {(dateRange.startDate || dateRange.endDate) && (
                            <button
                                onClick={() => setDateRange({ startDate: "", endDate: "" })}
                                className="text-xs font-bold text-primary hover:underline"
                            >
                                Clear filter
                            </button>
                        )}
                    </div>

                    {/* History by Month */}
                    <div className="space-y-6">
                        {Object.entries(byMonth).length === 0 ? (
                            <div className="glass rounded-[2.5rem] p-14 text-center border border-white/20">
                                <CalendarDays className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">No attendance records found.</p>
                            </div>
                        ) : (
                            Object.entries(byMonth).map(([month, recs]) => {
                                const presentInMonth = recs.filter(r => r.status === "present" || r.status === "late").length;
                                const monthPct = Math.round((presentInMonth / recs.length) * 100);
                                return (
                                    <div key={month} className="space-y-3">
                                        <div className="flex items-center justify-between px-2">
                                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{month}</h3>
                                            <span className={cn(
                                                "text-xs font-black px-3 py-1 rounded-lg",
                                                monthPct >= 80 ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
                                                monthPct >= 60 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" :
                                                "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                            )}>
                                                {monthPct}% this month
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {recs.map(record => {
                                                const style = STATUS_STYLES[record.status] ?? STATUS_STYLES.present;
                                                return (
                                                    <div
                                                        key={record.id}
                                                        className="glass rounded-2xl px-5 py-4 border border-white/20 flex items-center justify-between gap-4"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-center min-w-[40px]">
                                                                <p className="text-lg font-black text-slate-900 dark:text-white leading-none">
                                                                    {new Date(record.date).getDate()}
                                                                </p>
                                                                <p className="text-[9px] font-bold uppercase text-slate-400">
                                                                    {new Date(record.date).toLocaleDateString("en-US", { weekday: "short" })}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{record.class.name}</p>
                                                                <p className="text-[11px] text-slate-500">{record.class.subject.name}</p>
                                                            </div>
                                                        </div>
                                                        <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl", style.bg, style.color)}>
                                                            {style.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
