"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
    Users, BookOpen, Clock, BarChart3, TrendingUp, 
    CheckCircle2, AlertCircle, Calendar, GraduationCap 
} from "lucide-react";
import { SparkleCard } from "@/components/ui/sparkle-card";
import { cn } from "@/lib/utils";

import { usePlatformMetrics } from "@/hooks/use-metrics";

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: { value: string; positive: boolean };
    color: string;
}

function MetricCard({ title, value, icon, trend, color }: MetricCardProps) {
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className="glass p-6 rounded-[2rem] border border-white/20 shadow-xl relative overflow-hidden"
        >
            <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-20", color)} />
            <div className="flex justify-between items-start relative z-10">
                <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{value}</h3>
                </div>
                <div className={cn("p-3 rounded-2xl text-white shadow-lg", color)}>
                    {icon}
                </div>
            </div>
            {trend && (
                <div className="mt-4 flex items-center gap-2">
                    <span className={cn("text-xs font-bold", trend.positive ? "text-emerald-500" : "text-rose-500")}>
                        {trend.positive ? "+" : "-"}{trend.value}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">vs last month</span>
                </div>
            )}
        </motion.div>
    );
}

export function MetricsDashboard({ metrics: _unused }: { metrics?: any }) {
    const { data, isLoading, isError } = usePlatformMetrics();

    if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    if (isError) return <div className="text-center py-12 text-rose-500 font-bold">Failed to load platform metrics.</div>;

    const stats = data.metrics;
    const patterns = data.patterns;

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">System Oversight</h2>
                    <p className="text-slate-500 font-medium">Real-time platform performance & engagement metrics.</p>
                </div>
                <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/20">
                    <button className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest shadow-lg">Daily</button>
                    <button className="px-4 py-2 rounded-xl text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all">Weekly</button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Active Students" 
                    value={stats.students} 
                    icon={<Users className="w-6 h-6" />} 
                    trend={{ value: "12%", positive: true }}
                    color="bg-blue-500"
                />
                <MetricCard 
                    title="Attendance Rate" 
                    value={`${stats.attendanceRate}%`} 
                    icon={<Calendar className="w-6 h-6" />} 
                    trend={{ value: "2%", positive: true }}
                    color="bg-emerald-500"
                />
                <MetricCard 
                    title="Course Completion" 
                    value={`${stats.averageCourseCompletion}%`} 
                    icon={<CheckCircle2 className="w-6 h-6" />} 
                    trend={{ value: "5%", positive: true }}
                    color="bg-purple-500"
                />
                <MetricCard 
                    title="Total Engagement" 
                    value={stats.totalEngagement} 
                    icon={<TrendingUp className="w-6 h-6" />} 
                    trend={{ value: "8%", positive: true }}
                    color="bg-orange-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Attendance Patterns */}
                <div className="lg:col-span-3 glass p-8 rounded-[2.5rem] border border-white/20 shadow-2xl space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-black text-slate-800 dark:text-white">Attendance Patterns</h3>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-primary" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Present</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-slate-200" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Absent</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Attendance Patterns (Engagement) */}
                    <div className="h-64 w-full flex items-end justify-between gap-1 px-2">
                        {patterns.map((count: number, i: number) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                <motion.div 
                                    initial={{ height: 0 }}
                                    animate={{ height: `${Math.min(100, (count / (Math.max(...patterns) || 1)) * 100)}%` }}
                                    className="w-full max-w-[12px] bg-primary/20 rounded-t-lg relative group overflow-hidden"
                                >
                                    <div className="absolute bottom-0 w-full bg-primary rounded-t-lg transition-all" style={{ height: '80%' }} />
                                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </motion.div>
                                <span className="text-[8px] font-bold text-slate-400">{i}h</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
