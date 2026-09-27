"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Plus, Search, Filter, ChevronRight, Users, Clock, Layers } from "lucide-react";
import { useCourses } from "@schoolos/hooks";

export default function AdminCoursesPage() {
    const { data: courses, isLoading } = useCourses();

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-primary" />
                        Courses
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage the full course catalog.</p>
                </div>
                <Link href="/admin/courses/new">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-5 h-5" />
                        New Course
                    </motion.button>
                </Link>
            </header>

            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search courses..."
                        className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm outline-none focus:border-primary transition-all shadow-sm"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold hover:bg-white dark:hover:bg-slate-800 transition-all">
                    <Filter className="w-4 h-4" />
                    Filter
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : courses && courses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course: any, i: number) => (
                        <motion.div
                            key={course.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="glass rounded-[2.5rem] p-6 border border-white/20 flex flex-col transition-all hover:scale-[1.02] group"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                <BookOpen className="w-7 h-7 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors">{course.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{course.description || "No description"}</p>
                            <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5" />
                                    {course._count?.enrollments ?? 0}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Layers className="w-3.5 h-3.5" />
                                    {course._count?.modules ?? 0}
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="glass rounded-[2.5rem] p-16 text-center border border-white/20">
                    <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-400 mb-2">No courses yet</h3>
                    <p className="text-muted-foreground mb-6">Create your first course to get started.</p>
                    <Link href="/admin/courses/new">
                        <button className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest">
                            Create Course
                        </button>
                    </Link>
                </div>
            )}
        </div>
    );
}
