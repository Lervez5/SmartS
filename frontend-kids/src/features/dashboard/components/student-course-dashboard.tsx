"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    BookOpen, Trophy, Calendar, Clock, 
    ChevronRight, Sparkles, Layout, 
    Code, Brain, Link as LinkIcon, Users,
    Search, Filter, Play, Star
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useStudentEnrollments } from "@/hooks/use-courses";
import { useAuthStore } from "@/store/auth.store";

export function StudentCourseDashboard() {
    const { user } = useAuthStore();
    const { data: enrollments, isLoading } = useStudentEnrollments(user?.id || "");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");

    const categories = [
        "All", "Software Development", "Artificial Intelligence", "Personal Development", "Blockchain"
    ];

    const filteredEnrollments = enrollments?.filter((e: any) => {
        const matchesSearch = e.course.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === "All" || e.course.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="w-full space-y-10 pb-20">
            {/* Header with Search and Filter */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.3em]">
                        <Sparkles className="w-4 h-4" /> Academic Journey
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Your Curriculum</h1>
                    <p className="text-slate-500 font-medium max-w-xl">Master your craft through your assigned cohort modules and specialized curriculum paths.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search modules..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-6 py-4 rounded-[1.5rem] bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all border border-slate-200 dark:border-slate-800 shadow-sm w-full sm:w-auto">
                        <Filter className="w-4 h-4" /> Advanced Filter
                    </button>
                </div>
            </header>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                            "px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                            selectedCategory === cat
                                ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105"
                                : "bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800"
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                    {filteredEnrollments && filteredEnrollments.length > 0 ? (
                        filteredEnrollments.map((e: any, i: number) => (
                            <motion.div
                                key={e.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <CourseCard enrollment={e} />
                            </motion.div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 text-center space-y-4">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300">
                                <BookOpen className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-400 italic">No matching curriculum found.</h3>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function CourseCard({ enrollment }: { enrollment: any }) {
    const course = enrollment.course;
    const colors: Record<string, string> = {
        "Software Development": "from-blue-500 to-indigo-600",
        "Artificial Intelligence": "from-purple-500 to-fuchsia-600",
        "Personal Development": "from-amber-500 to-orange-600",
        "Blockchain": "from-emerald-500 to-teal-600"
    };

    const colorClass = colors[course.category] || "from-slate-700 to-slate-900";

    return (
        <Link href={`/dashboard/student/courses/${course.id}`}>
            <motion.div 
                whileHover={{ y: -8 }}
                className="group relative h-full rounded-[3rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500"
            >
                {/* Visual Accent */}
                <div className={cn("h-32 bg-gradient-to-br relative overflow-hidden", colorClass)}>
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl" />
                    
                    <div className="absolute top-6 left-8 px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-[9px] font-black uppercase tracking-widest text-white">
                        {course.category}
                    </div>
                </div>

                <div className="p-8 pt-0 -mt-12 relative z-10">
                    <div className="w-20 h-20 rounded-[2rem] bg-white dark:bg-slate-800 shadow-2xl flex items-center justify-center border-4 border-white dark:border-slate-900 mb-6 group-hover:scale-110 transition-transform duration-500">
                        <BookOpen className="w-8 h-8 text-primary" />
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-2 group-hover:text-primary transition-colors">
                                {course.title}
                            </h3>
                            <div className="flex items-center gap-4 text-slate-400">
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight">
                                    <Clock className="w-3.5 h-3.5" /> {course._count?.modules || 0} Modules
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight">
                                    <Users className="w-3.5 h-3.5" /> Cohort Session
                                </span>
                            </div>
                        </div>

                        {/* Progress Engine */}
                        <div className="space-y-3 p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                <span className="text-slate-500">Mastery Progress</span>
                                <span className="text-primary">{enrollment.progress}%</span>
                            </div>
                            <div className="h-2 bg-white dark:bg-slate-900 rounded-full overflow-hidden shadow-inner">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${enrollment.progress}%` }}
                                    className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.4)]"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-1">
                                {[1,2,3,4,5].map(star => (
                                    <Star key={star} className={cn("w-3 h-3", star <= 4 ? "text-amber-400 fill-amber-400" : "text-slate-200")} />
                                ))}
                                <span className="ml-2 text-[9px] font-black text-slate-400">4.9/5</span>
                            </div>
                            <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all">
                                Resume <Play className="w-3 h-3 fill-current" />
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}
