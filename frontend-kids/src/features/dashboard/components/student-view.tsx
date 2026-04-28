"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Trophy, Star, ArrowRight, Play, Sparkles } from "lucide-react";
import { SparkleCard } from "@/components/ui/sparkle-card";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { getGamificationProfile, GamificationProfile } from "@/lib/ai-service";
import { useStudentDashboard } from "@/hooks/use-dashboard";
import { useGamificationProfile } from "@/hooks/use-gamification";

const SUBJECTS = [
    { id: "S1", name: "Mathematics", icon: "🔢", color: "bg-blue-500", lessons: 12, completed: 8, progress: 66 },
    { id: "S2", name: "English", icon: "📚", color: "bg-orange-500", lessons: 10, completed: 4, progress: 40 },
    { id: "S3", name: "Science", icon: "🧬", color: "bg-purple-500", lessons: 8, completed: 2, progress: 25 },
];

const RECENT_LESSONS = [
    { id: "L1", title: "Introduction to Fractions", subject: "Mathematics", time: "2h ago" },
    { id: "L2", title: "Photosynthesis Basics", subject: "Science", time: "Yesterday" },
];

export function StudentView() {
    const { user } = useAuthStore();
    const router = useRouter();
    
    // Use TanStack Query instead of local state + useEffect
    const { data: dashboardData, isLoading: dashboardLoading, isError: dashboardError } = useStudentDashboard();
    const { data: profile, isLoading: profileLoading } = useGamificationProfile(user?.id);
    
    const isLoading = dashboardLoading || profileLoading;
    const isError = dashboardError;

    useEffect(() => {
        if (!user) return;
        
        // Enforce student role
        if (user.role !== "student") {
            const dest = user.role === "parent" ? "/parent" : (user.role === "super_admin" || user.role === "school_admin") ? "/admin" : "/dashboard/teacher";
            router.replace(dest);
        }
    }, [user, router]);

    if (!user || user.role !== "student") {
        return null;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-center py-12">
                <h3 className="text-xl font-bold text-destructive">Failed to load dashboard</h3>
                <p className="text-muted-foreground">Please try again later.</p>
            </div>
        );
    }

    const upcomingClasses = dashboardData?.upcomingClasses || [];
    const pendingAssignments = dashboardData?.pendingAssignments || [];
    const recentGrades = dashboardData?.recentGrades || [];
    const progressData = dashboardData?.progress || [];

    // Calculate XP for next level: 100 * (Level ^ 1.5)
    const nextLevelXp = profile ? Math.floor(100 * Math.pow(profile.level, 1.5)) : 100;
    const progressToNext = profile ? (profile.xp / nextLevelXp) * 100 : 0;

    return (
        <div className="space-y-10 pb-20">
            {/* Welcome Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-center md:text-left">Welcome back, {user?.name || "Sprout"}! 👋</h1>
                    <p className="text-muted-foreground text-base md:text-lg text-center md:text-left">Your brain is growing every day. Ready for more?</p>
                </div>

                {/* Level Badge in Header */}
                <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-6 py-3 rounded-[2rem] border border-white/20 dark:border-white/10 shadow-xl self-center md:self-auto">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-lg rotate-3">
                            {profile?.level || 1}
                        </div>
                        <div className="absolute -top-1 -right-1">
                            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-primary">Level</div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Sprouty Apprentice</div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Featured Subject Card (Upcoming Class) */}
                    <section>
                        {upcomingClasses.length > 0 ? (
                            <SparkleCard className="p-0 border-none group overflow-hidden">
                                <div className="bg-gradient-to-br from-primary via-primary/90 to-brand-dark p-8 text-white relative">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 relative z-10">
                                        <div className="space-y-1">
                                            <span className="text-white/70 dark:text-white/90 text-[10px] md:text-xs font-bold uppercase tracking-widest bg-white/10 dark:bg-slate-900/40 px-3 py-1 rounded-full whitespace-nowrap">Next Class</span>
                                            <h2 className="text-3xl md:text-4xl font-black mt-3">{upcomingClasses[0].subject.name}</h2>
                                            <p className="text-white/80 font-medium">with {upcomingClasses[0].teacher.name} • {new Date(upcomingClasses[0].schedule).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-[1.5rem] md:rounded-[2rem] bg-white/20 dark:bg-slate-900/20 backdrop-blur-xl flex items-center justify-center text-2xl md:text-3xl shadow-inner border border-white/20 dark:border-white/10 rotate-6 group-hover:rotate-0 transition-transform self-end sm:self-auto">
                                            🎓
                                        </div>
                                    </div>

                                    <button className="mt-8 w-full sm:w-auto flex items-center justify-center gap-2 bg-white dark:bg-slate-900 text-primary px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:scale-[1.05] active:scale-[0.95] transition-all shadow-xl hover:shadow-primary/20">
                                        <Play className="w-5 h-5 fill-current" />
                                        Join Session
                                    </button>
                                </div>
                            </SparkleCard>
                        ) : (
                            <div className="glass p-8 rounded-[2.5rem] text-center border border-white/20">
                                <h3 className="text-xl font-bold">No upcoming classes</h3>
                                <p className="text-muted-foreground">Check back later or explore new subjects!</p>
                            </div>
                        )}
                    </section>

                    {/* Assignments Due */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Assignments Due</h3>
                            <button className="text-primary text-sm font-semibold hover:underline">View All</button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {pendingAssignments.length > 0 ? pendingAssignments.map((assignment: any) => (
                                <motion.div
                                    key={assignment.id}
                                    whileHover={{ x: 10 }}
                                    className="glass p-6 rounded-[2rem] flex items-center justify-between border border-white/20 group cursor-pointer"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                                            <BookOpen className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200">{assignment.title}</h4>
                                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Due {new Date(assignment.dueDate).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </motion.div>
                            )) : (
                                <p className="text-muted-foreground text-center py-4">Hooray! No pending assignments. 🎉</p>
                            )}
                        </div>
                    </section>

                    {/* Recent Activity / Grades */}
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold">Recent Results</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {recentGrades.map((grade: any) => (
                                <motion.div
                                    key={grade.id}
                                    whileHover={{ y: -5 }}
                                    className="glass p-6 rounded-[2.5rem] border border-white/20"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                                            <Trophy className="w-6 h-6" />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-black text-slate-900 dark:text-white">{grade.rawScore}%</div>
                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Score</div>
                                        </div>
                                    </div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate">{grade.exercise.lesson.title}</h4>
                                    <p className="text-xs text-muted-foreground">{new Date(grade.createdAt).toLocaleDateString()}</p>
                                </motion.div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Sidebar Activity Area */}
                <div className="space-y-8">
                    {/* XP Progress Card */}
                    <section className="glass p-8 rounded-[2.5rem] space-y-8 relative overflow-hidden border border-white/20 shadow-2xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <div className="flex justify-between items-center relative z-10">
                            <h3 className="font-black text-xl text-slate-800 dark:text-white">Your Progress</h3>
                            <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                <Trophy className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div className="flex items-end justify-between">
                                <div className="space-y-1">
                                    <div className="text-3xl font-black text-slate-900 dark:text-white">{profile?.xp || 0}</div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total XP</div>
                                </div>
                                <div className="text-right space-y-1">
                                    <div className="text-sm font-bold text-slate-600">{nextLevelXp} XP to Lvl {(profile?.level || 1) + 1}</div>
                                    <div className="text-[10px] font-bold text-primary uppercase tracking-widest">Next Milestone</div>
                                </div>
                            </div>

                            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
                                <motion.div
                                    className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressToNext}%` }}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div className="bg-white/40 dark:bg-slate-900/40 p-4 rounded-2xl border border-white/20 dark:border-white/10">
                                <div className="flex items-center gap-2 text-amber-600 mb-1">
                                    <Star className="w-4 h-4 fill-current" />
                                    <span className="text-lg font-black">{profile?.badges?.length || 0}</span>
                                </div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Badges Earned</p>
                            </div>
                            <div className="bg-white/40 dark:bg-slate-900/40 p-4 rounded-2xl border border-white/20 dark:border-white/10">
                                <div className="flex items-center gap-2 text-primary mb-1">
                                    <Play className="w-4 h-4" />
                                    <span className="text-lg font-black">12</span>
                                </div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Daily Streak</p>
                            </div>
                        </div>
                    </section>

                    {/* Cohort Curriculum Progress */}
                    <section className="space-y-4">
                        <h3 className="font-bold text-lg uppercase tracking-tight">Curriculum Journey</h3>
                        <div className="space-y-3">
                            {progressData.map((p: any) => (
                                <div key={p.id} className="glass p-4 rounded-2xl border border-white/20">
                                    <div className="flex justify-between text-sm font-bold mb-2">
                                        <span>{p.subject.name}</span>
                                        <span>{p.percent}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-primary transition-all duration-500" 
                                            style={{ width: `${p.percent}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
