"use client";

import React, { useState } from "react";
import { 
    BarChart3, FileText, Download, TrendingUp, 
    Users, BookOpen, Wallet, Calendar, Sparkles,
    Filter, ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
    useAcademicReport, 
    useAttendanceReport, 
    useFinancialReport, 
    usePlatformAnalytics 
} from "@/hooks/use-reporting";
import { useSubjects } from "@/hooks/use-subjects";
import { AcademicBarChart, AttendancePieChart, PerformanceTrendChart } from "./reporting-charts";
import axios from "axios";

const API = "http://localhost:4000/api";

export function ReportingCenter() {
    const [activeReport, setActiveReport] = useState<"academic" | "attendance" | "financial" | "performance">("academic");
    const [filterModule, setFilterModule] = useState("all");

    const academic = useAcademicReport();
    const attendance = useAttendanceReport();
    const financial = useFinancialReport();
    const analytics = usePlatformAnalytics();
    const subjects = useSubjects();

    const handleExport = async (format: "csv" | "pdf") => {
        try {
            await axios.post(`${API}/reporting/export`, {
                type: activeReport,
                format
            }, { withCredentials: true });
            alert(`Report generation started! You will be notified when the ${format.toUpperCase()} is ready.`);
        } catch (err) {
            console.error("Export failed", err);
            alert("Failed to start export.");
        }
    };

    const reports = {
        academic,
        attendance,
        financial,
        performance: analytics
    };

    const currentReport = reports[activeReport];

    const reportTypes = [
        { id: "academic", label: "Academic Reports", icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10" },
        { id: "attendance", label: "Attendance Trends", icon: Calendar, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        { id: "financial", label: "Financial Summary", icon: Wallet, color: "text-amber-500", bg: "bg-amber-500/10" },
        { id: "performance", label: "Performance Analytics", icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10" },
    ];

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Reporting Center</h1>
                    <p className="text-slate-500 font-medium">Generate and export platform-wide intelligence reports.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => handleExport("csv")}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm hover:bg-slate-50 transition-all"
                    >
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button 
                        onClick={() => handleExport("pdf")}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    >
                        <FileText className="w-4 h-4" /> Export PDF
                    </button>
                </div>
            </header>

            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Filter:</span>
                    <select 
                        value={filterModule}
                        onChange={(e) => setFilterModule(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm font-black text-slate-900 dark:text-white outline-none cursor-pointer"
                    >
                        <option value="all">All Modules</option>
                        {subjects.data?.map((subject: any) => (
                            <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
                
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-black text-slate-900 dark:text-white">Last 30 Days</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {reportTypes.map((type) => (
                    <button
                        key={type.id}
                        onClick={() => setActiveReport(type.id as any)}
                        className={cn(
                            "p-6 rounded-[2.5rem] border transition-all text-left group relative overflow-hidden",
                            activeReport === type.id 
                                ? "bg-white dark:bg-slate-900 border-primary shadow-xl ring-4 ring-primary/5" 
                                : "bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-primary/50"
                        )}
                    >
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", type.bg)}>
                            <type.icon className={cn("w-6 h-6", type.color)} />
                        </div>
                        <h3 className="font-black text-slate-900 dark:text-white">{type.label}</h3>
                        <p className="text-xs text-slate-500 mt-1">Platform-wide insights</p>
                        
                        {activeReport === type.id && (
                            <div className="absolute top-4 right-4">
                                <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                            </div>
                        )}
                    </button>
                ))}
            </div>

            <main className="glass rounded-[3.5rem] border border-white/20 p-8 lg:p-12 shadow-2xl min-h-[500px]">
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                {reportTypes.find(t => t.id === activeReport)?.label} Analytics
                            </h2>
                            <p className="text-sm text-slate-500 font-medium">Real-time data visualization</p>
                        </div>
                    </div>
                    {currentReport.isLoading ? (
                         <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Loading Data...
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Last Updated: {new Date().toLocaleTimeString()}
                        </div>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {currentReport.isLoading ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center min-h-[400px] space-y-4"
                        >
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Aggregating System Intelligence...</p>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key={activeReport}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-12"
                        >
                            {/* Summary Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {activeReport === "academic" && currentReport.data && (
                                    <>
                                        <MetricCard label="Total Courses" value={currentReport.data.summary.totalCourses} trend="+2.4%" />
                                        <MetricCard label="Active Enrollments" value={currentReport.data.summary.totalEnrollments} trend="+5.1%" />
                                        <MetricCard label="Average Progress" value={`${Math.round(currentReport.data.summary.averageProgress)}%`} trend="+1.2%" />
                                    </>
                                )}

                                {activeReport === "attendance" && currentReport.data && (
                                    <>
                                        <MetricCard label="Total Records" value={currentReport.data.totalRecords} trend="+0.8%" />
                                        <MetricCard label="Present Rate" value={`${Math.round((currentReport.data.statusDistribution.find((s:any) => s.status === 'present')?._count.id / currentReport.data.totalRecords) * 100 || 0)}%`} trend="+2.1%" />
                                        <MetricCard label="Late Rate" value={`${Math.round((currentReport.data.statusDistribution.find((s:any) => s.status === 'late')?._count.id / currentReport.data.totalRecords) * 100 || 0)}%`} trend="-1.5%" />
                                    </>
                                )}

                                {activeReport === "performance" && currentReport.data && (
                                    <>
                                        <MetricCard label="Total Users" value={currentReport.data.userRoles.reduce((acc:number, r:any) => acc + r._count.id, 0)} trend="+3.2%" />
                                        <MetricCard label="Module Average" value="78%" trend="+4.5%" />
                                        <MetricCard label="Retention" value="94%" trend="+1.0%" />
                                    </>
                                )}
                            </div>

                            {/* Chart Visualization */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="glass p-8 rounded-[3rem] border border-white/10 space-y-6">
                                    <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-primary" /> Primary Distribution
                                    </h3>
                                    {activeReport === "academic" && currentReport.data && (
                                        <AcademicBarChart data={currentReport.data.distribution} />
                                    )}
                                    {activeReport === "attendance" && currentReport.data && (
                                        <AttendancePieChart data={currentReport.data.statusDistribution} />
                                    )}
                                    {activeReport === "performance" && currentReport.data && (
                                        <PerformanceTrendChart data={currentReport.data.modulePerformance} />
                                    )}
                                </div>

                                <div className="glass p-8 rounded-[3rem] border border-white/10 space-y-6">
                                    <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <Users className="w-5 h-5 text-primary" /> Demographic Breakdown
                                    </h3>
                                    {activeReport === "performance" && currentReport.data && (
                                        <div className="space-y-6">
                                            {currentReport.data.userRoles.map((role: any) => (
                                                <div key={role.role} className="space-y-2">
                                                    <div className="flex justify-between items-center px-2">
                                                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">{role.role}</span>
                                                        <span className="text-sm font-bold">{role._count.id} Users</span>
                                                    </div>
                                                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-primary rounded-full transition-all duration-1000"
                                                            style={{ width: `${(role._count.id / currentReport.data.userRoles.reduce((acc:any, r:any) => acc + r._count.id, 0)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {activeReport !== "performance" && (
                                        <div className="flex flex-col items-center justify-center h-[300px] text-center space-y-4">
                                            <Sparkles className="w-12 h-12 text-slate-200" />
                                            <p className="text-slate-400 font-medium italic max-w-xs">Detailed demographics for this report type are currently being aggregated.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

function MetricCard({ label, value, trend }: { label: string, value: string | number, trend: string }) {
    const isPositive = trend.startsWith("+");
    return (
        <div className="p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group">
            <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">{label}</span>
                <div className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold",
                    isPositive ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                )}>
                    {trend}
                </div>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {value}
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-2/3 rounded-full" />
            </div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Growth Benchmark 2026</p>
        </div>
    );
}
