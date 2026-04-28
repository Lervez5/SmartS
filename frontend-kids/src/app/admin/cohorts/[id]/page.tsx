"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Users, BookOpen, Calendar, ChevronLeft, 
    Search, UserPlus, MoreVertical, Shield,
    CheckCircle2, Lock, Unlock, Mail, Trash2,
    BarChart3, Clock, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortDetails, useUpdateCohort } from "@/hooks/use-cohorts";
import Link from "next/link";
import axios from "axios";

export default function AdminCohortDetails() {
    const { id } = useParams();
    const { data: cohort, isLoading, refetch } = useCohortDetails(id as string);
    const [activeTab, setActiveTab] = useState("students");
    const [searchQuery, setSearchQuery] = useState("");

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!cohort) return <div>Cohort not found</div>;

    const filteredStudents = cohort.enrollments?.filter((e: any) => 
        e.student.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="w-full space-y-10 pb-20">
            {/* Header */}
            <header className="space-y-6">
                <Link href="/admin/cohorts" className="flex items-center gap-2 text-slate-400 hover:text-primary transition-all text-[10px] font-black uppercase tracking-widest">
                    <ChevronLeft className="w-4 h-4" /> Back to Manager
                </Link>
                
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest">
                                {cohort.subject?.name}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" /> ID: {cohort.id.slice(-6)}
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">
                            {cohort.name}
                        </h1>
                        <p className="text-slate-500 font-medium max-w-2xl">{cohort.description || "No description provided for this intake."}</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-6 py-4 rounded-[1.5rem] bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-slate-800 shadow-sm">
                            <Mail className="w-4 h-4" /> Message Cohort
                        </button>
                        <button className="flex items-center gap-3 px-8 py-4 rounded-[1.5rem] bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.03] transition-all">
                            <BarChart3 className="w-4 h-4" /> Performance Report
                        </button>
                    </div>
                </div>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Total Students", value: cohort._count?.enrollments || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
                    { label: "Avg Progress", value: "68%", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                    { label: "Module Status", value: "4/12", icon: BookOpen, color: "text-purple-500", bg: "bg-purple-500/10" },
                    { label: "Attendance", value: "92%", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" }
                ].map((s, i) => (
                    <div key={i} className="glass p-6 rounded-[2.5rem] border border-white/20 flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", s.bg)}>
                            <s.icon className={cn("w-6 h-6", s.color)} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{s.label}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-8 border-b border-slate-100 dark:border-slate-800">
                {["students", "curriculum", "schedule"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "pb-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative",
                            activeTab === tab ? "text-primary" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        {tab}
                        {activeTab === tab && (
                            <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-8">
                {activeTab === "students" && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Search students..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
                                />
                            </div>
                            <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary/10 text-primary font-black text-[10px] uppercase tracking-widest hover:bg-primary/20 transition-all">
                                <UserPlus className="w-4 h-4" /> Individual Enroll
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredStudents?.map((e: any) => (
                                <div key={e.id} className="glass p-6 rounded-[2.5rem] border border-white/20 group relative">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                            {e.student.avatar ? (
                                                <img src={e.student.avatar} alt={e.student.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Users className="w-6 h-6 text-slate-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-900 dark:text-white truncate">{e.student.name}</h4>
                                            <p className="text-[10px] font-medium text-slate-500 truncate">{e.student.email}</p>
                                        </div>
                                        <button className="p-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="mt-6 space-y-2">
                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                                            <span>Learning Progress</span>
                                            <span className="text-primary">{e.progress || 0}%</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: `${e.progress || 0}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "curriculum" && (
                    <div className="space-y-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Assigned Curriculum</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                                    {cohort.course?.title || "No curriculum linked"}
                                </p>
                            </div>
                            <Link href={`/dashboard/teacher/courses/${cohort.courseId}`} className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2 hover:translate-x-2 transition-all">
                                Open Architect <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        <div className="space-y-4">
                            {cohort.course?.modules?.map((module: any, i: number) => (
                                <ModuleItem key={module.id} module={module} order={i+1} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ModuleItem({ module, order }: { module: any, order: number }) {
    const [isLocked, setIsLocked] = useState(module.isLocked);

    const toggleLock = async () => {
        try {
            await axios.put(`http://localhost:4000/api/courses/modules/${module.id}/toggle-lock`, {}, { withCredentials: true });
            setIsLocked(!isLocked);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="glass p-8 rounded-[3rem] border border-white/20 flex flex-col md:flex-row md:items-center justify-between gap-6 group">
            <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shrink-0 shadow-xl">
                    {order}
                </div>
                <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">{module.title}</h4>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" /> {module.units?.length || 0} Units
                        </span>
                        <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1.5",
                            isLocked ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                        )}>
                            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            {isLocked ? "Locked" : "Active"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button 
                    onClick={toggleLock}
                    className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
                        isLocked ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                    )}
                >
                    {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {isLocked ? "Unlock Module" : "Lock Module"}
                </button>
                <button className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                    <MoreVertical className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
