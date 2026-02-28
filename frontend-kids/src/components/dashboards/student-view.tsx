"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Trophy, Star, ArrowRight, Play, Sparkles } from "lucide-react";
import { SparkleCard } from "@/components/sparkle-card";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { getGamificationProfile, GamificationProfile } from "@/lib/ai-service";

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
    const [profile, setProfile] = useState<GamificationProfile | null>(null);

    useEffect(() => {
        if (user?.id) {
            getGamificationProfile(user.id).then(setProfile);
        }
    }, [user?.id]);

    // Calculate XP for next level: 100 * (Level ^ 1.5)
    const nextLevelXp = profile ? Math.floor(100 * Math.pow(profile.level, 1.5)) : 100;
    const progressToNext = profile ? (profile.xp / nextLevelXp) * 100 : 0;

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            {/* Welcome Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name || "Sprout"}! 👋</h1>
                    <p className="text-muted-foreground text-lg">Your brain is growing every day. Ready for more?</p>
                </div>

                {/* Level Badge in Header */}
                <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-6 py-3 rounded-[2rem] border border-white/20 dark:border-white/10 shadow-xl">
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
                    {/* Featured Subject Card */}
                    <section>
                        <SparkleCard className="p-0 border-none group overflow-hidden">
                            <div className="bg-gradient-to-br from-primary via-primary/90 to-brand-dark p-8 text-white relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                                <div className="flex justify-between items-start mb-8 relative z-10">
                                    <div className="space-y-1">
                                        <span className="text-white/70 dark:text-white/90 text-xs font-bold uppercase tracking-widest bg-white/10 dark:bg-slate-900/40 px-3 py-1 rounded-full">Currently Learning</span>
                                        <h2 className="text-4xl font-black mt-3">Mathematics</h2>
                                    </div>
                                    <div className="w-16 h-16 rounded-[2rem] bg-white/20 dark:bg-slate-900/20 backdrop-blur-xl flex items-center justify-center text-3xl shadow-inner border border-white/20 dark:border-white/10 rotate-6 group-hover:rotate-0 transition-transform">
                                        🔢
                                    </div>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div className="flex justify-between text-sm font-bold">
                                        <span>Mastery Level</span>
                                        <span>66%</span>
                                    </div>
                                    <div className="h-4 bg-white/20 dark:bg-slate-900/20 rounded-full overflow-hidden border border-white/10 p-1">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: "66%" }}
                                            className="h-full bg-white dark:bg-slate-200 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                                        />
                                    </div>
                                </div>

                                <button className="mt-8 flex items-center gap-2 bg-white dark:bg-slate-900 text-primary px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider hover:scale-[1.05] active:scale-[0.95] transition-all shadow-xl hover:shadow-primary/20">
                                    <Play className="w-5 h-5 fill-current" />
                                    Launch Lesson
                                </button>
                            </div>
                        </SparkleCard>
                    </section>

                    {/* Subjects Grid */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold">Your Subjects</h3>
                            <button className="text-primary text-sm font-semibold hover:underline">Explore More</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {SUBJECTS.map((subject) => (
                                <motion.div
                                    key={subject.id}
                                    whileHover={{ y: -8, scale: 1.02 }}
                                    className="glass p-6 rounded-[2.5rem] group cursor-pointer border border-white/20"
                                >
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className={cn("w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-inner", subject.color, "bg-opacity-10")}>
                                            {subject.icon}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-lg text-slate-800 dark:text-slate-200">{subject.name}</h4>
                                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">{subject.lessons} missions total</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs font-bold text-slate-600">
                                            <span>{subject.completed} solved</span>
                                            <span>{subject.progress}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-1000", subject.color)}
                                                style={{ width: `${subject.progress}%` }}
                                            />
                                        </div>
                                    </div>
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
                                    <span className="text-lg font-black">{profile?.badges.length || 0}</span>
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

                    {/* Recent Achievements */}
                    <AnimatePresence>
                        {profile && profile.badges.length > 0 && (
                            <section className="space-y-4">
                                <h3 className="font-bold text-lg">Newest Badges</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {profile.badges.slice(-3).map((badge, i) => (
                                        <motion.div
                                            key={badge.code}
                                            initial={{ scale: 0, rotate: -20 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            title={badge.name}
                                            className="aspect-square glass rounded-2xl flex flex-col items-center justify-center p-2 group hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">🏆</div>
                                            <div className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter truncate w-full text-center">{badge.name}</div>
                                        </motion.div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </AnimatePresence>

                    {/* Recent Lessons */}
                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg">Next Up</h3>
                        </div>
                        <div className="space-y-3">
                            {RECENT_LESSONS.map((lesson) => (
                                <div key={lesson.id} className="group flex items-center gap-4 p-4 rounded-[1.5rem] border border-transparent glass hover:border-primary/20 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all cursor-pointer shadow-sm">
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        <BookOpen className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h5 className="text-sm font-bold truncate text-slate-800 dark:text-slate-200">{lesson.title}</h5>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{lesson.subject} • {lesson.time}</p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
