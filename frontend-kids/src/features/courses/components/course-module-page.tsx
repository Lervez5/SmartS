"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    BookOpen, Clock, Target, User, 
    ChevronRight, CheckCircle2, Play, 
    Star, Globe, BarChart, Calendar,
    Layers, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { useCourseDetails } from "@/hooks/use-courses";

export function CourseModulePage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { data: course, isLoading } = useCourseDetails(id);
    const [activeTab, setActiveTab] = useState<"curriculum" | "overview" | "instructor">("curriculum");
    const [expandedModules, setExpandedModules] = useState<string[]>([]);

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev => 
            prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
        );
    };

    if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    if (!course) return <div className="text-center py-12">Course not found.</div>;

    return (
        <div className="space-y-10 pb-20">
            {/* Header Section */}
            <header className="relative p-10 lg:p-16 rounded-[3.5rem] bg-slate-900 text-white overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <span className="px-4 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-[0.2em]">
                                {course.category || "Professional Track"}
                            </span>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black leading-tight tracking-tight">
                            {course.title}
                        </h1>
                        <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-lg">
                            {course.description || "Master the core concepts and advanced techniques in this comprehensive learning journey designed for aspiring professionals."}
                        </p>
                        <div className="flex flex-wrap gap-6 pt-4">
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                                <Globe className="w-4 h-4 text-primary" /> English
                            </div>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                                <Clock className="w-4 h-4 text-primary" /> 12 Hours Content
                            </div>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                                <BarChart className="w-4 h-4 text-primary" /> Intermediate
                            </div>
                        </div>
                        <div className="pt-6">
                            <button 
                                onClick={() => router.push(`/dashboard/student/courses/${course.id}/player`)}
                                className="bg-primary text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-[0_20px_50px_rgba(59,130,246,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                            >
                                <Play className="w-4 h-4 fill-current" /> Continue Learning
                            </button>
                        </div>
                    </div>

                    <div className="hidden lg:block">
                        <div className="bg-white/5 backdrop-blur-xl p-10 rounded-[3.5rem] border border-white/10 space-y-8">
                            <h3 className="text-xl font-black uppercase tracking-tight">Course Insights</h3>
                            <div className="grid grid-cols-2 gap-8">
                                {[
                                    { label: "Skill Level", value: "Intermediate", icon: BarChart },
                                    { label: "Total Units", value: course.modules?.reduce((acc:any, m:any) => acc + (m.units?.length || 0), 0) || 0, icon: Layers },
                                    { label: "Learning Mode", value: "Self-Paced", icon: Globe },
                                    { label: "Certificate", value: "Available", icon: Star },
                                ].map((item, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                            <item.icon className="w-3.5 h-3.5" /> {item.label}
                                        </div>
                                        <p className="font-black text-sm">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content Tabs */}
            <div className="space-y-12">
                <div className="flex border-b border-slate-200 dark:border-slate-800 gap-12">
                    {[
                        { id: "curriculum", label: "Curriculum", icon: BookOpen },
                        { id: "overview", label: "Overview", icon: Target },
                        { id: "instructor", label: "Instructor", icon: User },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "pb-8 text-xs font-black uppercase tracking-[0.2em] transition-all relative",
                                activeTab === tab.id ? "text-primary" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <span className="flex items-center gap-3">
                                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-primary" : "text-slate-300")} /> 
                                {tab.label}
                            </span>
                            {activeTab === tab.id && (
                                <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 inset-x-0 h-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="min-h-[500px]">
                    <AnimatePresence mode="wait">
                        {activeTab === "curriculum" && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-8"
                            >
                                {course.modules?.map((module: any, mIdx: number) => (
                                    <div key={module.id} className="glass rounded-[3.5rem] border border-white/20 shadow-xl overflow-hidden">
                                        <button 
                                            onClick={() => toggleModule(module.id)}
                                            className="w-full p-10 flex items-center justify-between hover:bg-white/50 transition-all text-left"
                                        >
                                            <div className="flex items-center gap-6">
                                                <div className="w-14 h-14 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                                                    M{(mIdx + 1)}
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-black uppercase tracking-tight">{module.title}</h3>
                                                    <p className="text-sm text-slate-500 font-medium">{module.units?.length || 0} Professional Units</p>
                                                </div>
                                            </div>
                                            <ChevronDown className={cn("w-6 h-6 text-slate-400 transition-transform", expandedModules.includes(module.id) && "rotate-180")} />
                                        </button>

                                        {expandedModules.includes(module.id) && (
                                            <div className="p-10 pt-0 space-y-8">
                                                {module.units?.map((unit: any, uIdx: number) => (
                                                    <div key={unit.id} className="space-y-4">
                                                        <div className="flex items-center gap-3 ml-2">
                                                            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                            <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                                                Unit {uIdx + 1}: {unit.title}
                                                            </h4>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {unit.lessons?.map((lesson: any) => (
                                                                <div key={lesson.id} className="p-5 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-primary/30 transition-all cursor-pointer">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                                                            <BookOpen className="w-5 h-5" />
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">{lesson.title}</span>
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">15 Mins</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* Overview and Instructor tabs remain consistent with high-fidelity design */}
                        {activeTab === "overview" && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="glass p-12 rounded-[3.5rem] border border-white/20 space-y-12"
                            >
                                <section className="space-y-6">
                                    <h3 className="text-3xl font-black tracking-tight">Curriculum Learning Outcomes</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {[
                                            "Architectural Foundations & System Design",
                                            "Advanced Pattern Recognition & Implementation",
                                            "Enterprise-Level Performance Optimization",
                                            "Full-Stack Integration & Security Protocols"
                                        ].map((outcome, i) => (
                                            <div key={i} className="flex items-start gap-5 p-6 rounded-[2rem] bg-white/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                                                    {outcome}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="space-y-6">
                                    <h3 className="text-3xl font-black tracking-tight">Academic Prerequisites</h3>
                                    <div className="p-8 rounded-[2.5rem] bg-primary/5 border-2 border-dashed border-primary/20 space-y-4">
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                            To ensure success in this module, students should possess:
                                        </p>
                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0">
                                            {["Introductory Sprout Foundation", "Basic subject proficiency", "Active growth mindset", "Technical environment setup"].map((pre, i) => (
                                                <li key={i} className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-primary">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" /> {pre}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </section>
                            </motion.div>
                        )}

                        {activeTab === "instructor" && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="glass p-12 rounded-[3.5rem] border border-white/20 flex flex-col md:flex-row gap-12 items-center md:items-start shadow-2xl"
                            >
                                <div className="w-64 h-64 rounded-[3rem] bg-slate-200 dark:bg-slate-800 overflow-hidden shadow-2xl border-8 border-white dark:border-slate-900 shrink-0 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                                    <img 
                                        src={course.teacher?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=teacher"} 
                                        alt="Instructor"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="space-y-8 text-center md:text-left py-4">
                                    <div>
                                        <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{course.teacher?.name || "Senior Instructor"}</h3>
                                        <p className="text-primary font-black uppercase tracking-[0.3em] text-xs mt-2">Lead Curriculum Architect</p>
                                    </div>
                                    <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-2xl">
                                        An industry veteran dedicated to building the next generation of specialized professionals. With over 15 years of practical experience, they focus on bridging the gap between theory and enterprise execution.
                                    </p>
                                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                        <button className="px-10 py-4 rounded-[1.5rem] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 active:scale-95 transition-all">
                                            View Full Profile
                                        </button>
                                        <button className="px-10 py-4 rounded-[1.5rem] bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all">
                                            Curriculum Updates
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
