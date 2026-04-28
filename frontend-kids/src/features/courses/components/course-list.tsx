"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
    BookOpen, Users, Clock, ChevronRight, 
    MoreVertical, Plus, Sparkles 
} from "lucide-react";
import Link from "next/link";
import { useCourses } from "@/hooks/use-courses";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";

export function CourseList() {
    const { user } = useAuthStore();
    const { data: courses, isLoading } = useCourses();

    // Filter courses assigned to this teacher (if not admin)
    const filteredCourses = courses?.filter((c: any) => 
        user?.role === 'super_admin' || user?.role === 'school_admin' || c.teacherId === user?.id
    ) || [];

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading curriculum...</p>
        </div>
    );

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        My Curriculum
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">
                        Manage course content and learning modules.
                    </p>
                </div>
                {(user?.role === 'super_admin' || user?.role === 'school_admin') && (
                    <Link 
                        href="/admin/courses/new"
                        className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Initialize New Course
                    </Link>
                )}
            </header>

            {filteredCourses.length === 0 ? (
                <div className="glass p-12 rounded-[3rem] border border-white/20 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center shadow-inner">
                        <BookOpen className="w-10 h-10 text-slate-400" />
                    </div>
                    <div className="max-w-xs">
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">No Courses Assigned</h3>
                        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                            {user?.role === 'teacher' 
                                ? "You haven't been assigned any courses yet. Please contact the administrator."
                                : "The system curriculum is empty. Start by initializing a new course shell."}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCourses.map((course: any, i: number) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            key={course.id}
                            className="glass p-6 rounded-[2.5rem] border border-white/20 hover:border-primary/30 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            
                            <div className="flex justify-between items-start relative z-10">
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform">
                                    <BookOpen className="w-5 h-5 text-primary" />
                                </div>
                                <button className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="mt-6 space-y-2 relative z-10">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                                    {course.title}
                                </h3>
                                <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                                    {course.subject?.name || "General"} • {course.category || "No Category"}
                                </p>
                            </div>

                            <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6 relative z-10">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(j => (
                                        <div key={j} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200" />
                                    ))}
                                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                                        +{course._count?.enrollments || 0}
                                    </div>
                                </div>
                                <Link 
                                    href={`/dashboard/teacher/courses/${course.id}/edit`}
                                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors group/btn"
                                >
                                    Build Content <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
