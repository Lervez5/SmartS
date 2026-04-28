"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Play, ChevronLeft, ChevronRight, CheckCircle2, 
    Circle, Video, FileText, BookOpen, Clock, 
    MessageCircle, Trophy, Sparkles, X, ListTree,
    ChevronDown, Menu, Layers, Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { useCourseDetails } from "@/hooks/use-courses";

interface Lesson {
    id: string;
    title: string;
    type: "video" | "pdf" | "note";
    duration?: string;
    completed: boolean;
}

interface Unit {
    id: string;
    title: string;
    lessons: Lesson[];
}

interface Module {
    id: string;
    title: string;
    isLocked: boolean;
    units: Unit[];
}

export function CoursePlayer() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { data: course, isLoading, isError } = useCourseDetails(id);
    const [currentLessonId, setCurrentLessonId] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [expandedModules, setExpandedModules] = useState<string[]>([]);
    const [expandedUnits, setExpandedUnits] = useState<string[]>([]);

    // Default to first lesson and expand first module/unit
    useEffect(() => {
        if (course?.modules?.length > 0) {
            const firstModule = course.modules[0];
            const firstUnit = firstModule.units?.[0];
            
            if (!currentLessonId && firstUnit?.lessons?.length > 0) {
                setCurrentLessonId(firstUnit.lessons[0].id);
            }
            if (expandedModules.length === 0) {
                setExpandedModules([firstModule.id]);
            }
            if (expandedUnits.length === 0 && firstUnit) {
                setExpandedUnits([firstUnit.id]);
            }
        }
    }, [course, currentLessonId, expandedModules.length, expandedUnits.length]);

    if (isLoading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (isError) return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <p className="text-rose-500 font-bold">Failed to load learning environment.</p>
            <button onClick={() => router.back()} className="text-primary font-bold hover:underline">Go Back</button>
        </div>
    );

    const modules: Module[] = (course?.modules || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        isLocked: m.status === "locked",
        units: (m.units || []).map((u: any) => ({
            id: u.id,
            title: u.title,
            lessons: (u.lessons || []).map((l: any) => ({
                id: l.id,
                title: l.title,
                type: l.lessonType || "note",
                completed: false 
            }))
        }))
    }));

    const allLessons = modules.flatMap(m => m.units.flatMap(u => u.lessons));
    const activeLesson = allLessons.find(l => l.id === currentLessonId);
    const activeUnit = modules.flatMap(m => m.units).find(u => u.lessons.some(l => l.id === currentLessonId));
    const activeModule = modules.find(m => m.units.some(u => u.id === activeUnit?.id));

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev => 
            prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
        );
    };

    const toggleUnit = (unitId: string) => {
        setExpandedUnits(prev => 
            prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
        );
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white dark:bg-slate-950">
            {/* Sidebar - Advanced Hierarchy */}
            <AnimatePresence mode="wait">
                {sidebarOpen && (
                    <motion.aside 
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 350, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-xl relative z-20"
                    >
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="font-black text-xs uppercase tracking-widest text-slate-400">Curriculum Structure</h2>
                            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {modules.map((module, mIdx) => (
                                <div key={module.id} className="border-b border-slate-100 dark:border-slate-800/50">
                                    <button 
                                        onClick={() => toggleModule(module.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-5 transition-all group",
                                            expandedModules.includes(module.id) ? "bg-white dark:bg-slate-800 shadow-sm" : "hover:bg-white/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-[10px]">
                                                {module.isLocked ? <Lock className="w-4 h-4" /> : `M${mIdx + 1}`}
                                            </div>
                                            <span className="text-sm font-black text-slate-900 dark:text-white text-left uppercase tracking-tight">
                                                {module.title}
                                            </span>
                                        </div>
                                        {module.isLocked ? (
                                            <div className="px-3 py-1 rounded-full bg-amber-100 text-amber-600 text-[8px] font-black uppercase tracking-widest">
                                                Locked
                                            </div>
                                        ) : (
                                            <ChevronDown className={cn(
                                                "w-4 h-4 text-slate-400 transition-transform duration-300",
                                                expandedModules.includes(module.id) && "rotate-180"
                                            )} />
                                        )}
                                    </button>
                                    <AnimatePresence>
                                        {expandedModules.includes(module.id) && !module.isLocked && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden space-y-1 py-2"
                                            >
                                                {module.units.map((unit, uIdx) => (
                                                    <div key={unit.id} className="px-4">
                                                        <button 
                                                            onClick={() => toggleUnit(unit.id)}
                                                            className={cn(
                                                                "w-full flex items-center justify-between p-3 rounded-xl transition-all",
                                                                expandedUnits.includes(unit.id) ? "bg-slate-100 dark:bg-slate-800/50" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <Layers className="w-4 h-4 text-slate-400" />
                                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                                    Unit {uIdx + 1}: {unit.title}
                                                                </span>
                                                            </div>
                                                            <ChevronRight className={cn(
                                                                "w-3 h-3 text-slate-300 transition-transform",
                                                                expandedUnits.includes(unit.id) && "rotate-90"
                                                            )} />
                                                        </button>
                                                        
                                                        {expandedUnits.includes(unit.id) && (
                                                            <div className="mt-1 ml-4 border-l-2 border-slate-100 dark:border-slate-800 space-y-0.5">
                                                                {unit.lessons.map((lesson) => (
                                                                    <button
                                                                        key={lesson.id}
                                                                        onClick={() => setCurrentLessonId(lesson.id)}
                                                                        className={cn(
                                                                            "w-full flex items-center gap-3 py-2.5 px-6 text-[13px] transition-all relative",
                                                                            currentLessonId === lesson.id 
                                                                                ? "text-primary font-bold" 
                                                                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                                                        )}
                                                                    >
                                                                        {lesson.type === "video" ? <Video className="w-3.5 h-3.5" /> :
                                                                         lesson.type === "pdf" ? <FileText className="w-3.5 h-3.5" /> :
                                                                         <BookOpen className="w-3.5 h-3.5" />}
                                                                        <span className="truncate">{lesson.title}</span>
                                                                        {currentLessonId === lesson.id && (
                                                                            <motion.div layoutId="activeLesson" className="absolute left-0 w-1 h-4 bg-primary rounded-full" />
                                                                        )}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950 overflow-hidden relative">
                {/* Advanced Slim Header */}
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        {!sidebarOpen && (
                            <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors mr-2">
                                <Menu className="w-5 h-5 text-slate-500" />
                            </button>
                        )}
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <span>{course?.title}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span className="text-primary">{activeModule?.title}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span className="text-slate-600 dark:text-slate-300">{activeUnit?.title}</span>
                            </div>
                            <h2 className="text-sm font-black text-slate-900 dark:text-white truncate max-w-md">
                                {activeLesson?.title}
                            </h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="hidden xl:flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Module Progress</p>
                                <p className="text-xs font-bold text-primary">75% Complete</p>
                            </div>
                            <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-primary w-3/4 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-400 hover:text-primary transition-all">
                                <MessageCircle className="w-5 h-5" />
                            </button>
                            <button className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-400 hover:text-primary transition-all">
                                <Trophy className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Content Viewer */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-16">
                    <div className="max-w-7xl mx-auto space-y-12">
                        {/* Unit Context Info */}
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-[1.25rem] bg-white dark:bg-slate-800 flex items-center justify-center text-primary shadow-sm">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{activeUnit?.title}</h4>
                                    <p className="text-xs text-slate-500 font-medium">Learning Outcomes: Advanced proficiency in core variables.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-center px-4">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attendance</p>
                                    <p className="text-xs font-bold text-emerald-500">Verified</p>
                                </div>
                                <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                                <div className="text-center px-4">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lessons</p>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">{activeUnit?.lessons?.length || 0}</p>
                                </div>
                            </div>
                        </div>

                        {/* Learning Asset */}
                        <div className="aspect-video w-full rounded-[3.5rem] bg-slate-900 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden relative group">
                            {activeLesson?.type === "video" ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-24 h-24 rounded-full bg-primary/90 flex items-center justify-center text-white shadow-[0_0_50px_rgba(59,130,246,0.5)] scale-100 group-hover:scale-110 transition-transform cursor-pointer">
                                        <Play className="w-10 h-10 fill-current ml-1" />
                                    </div>
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-white">
                                    <div className="w-20 h-20 rounded-[2rem] bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                                        {activeLesson?.type === "pdf" ? <FileText className="w-10 h-10 text-primary" /> : <BookOpen className="w-10 h-10 text-primary" />}
                                    </div>
                                    <div className="text-center">
                                        <p className="font-black uppercase tracking-[0.3em] text-xs opacity-60">Interactive Study Material</p>
                                        <h3 className="text-2xl font-black mt-2">{activeLesson?.title}</h3>
                                    </div>
                                    <button className="px-8 py-3 rounded-2xl bg-white text-slate-900 font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all">
                                        Open Viewer
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Text Content */}
                        <article className="prose prose-slate dark:prose-invert max-w-none">
                            <div className="space-y-4">
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Lecture Notes</span>
                                <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                                    {activeLesson?.title}
                                </h1>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
                                <div className="lg:col-span-2 space-y-8">
                                    <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                        Welcome to the detailed breakdown of {activeLesson?.title}. In this session, we dive deep into the 
                                        technical implementation and theoretical foundations required for {activeUnit?.title}.
                                    </p>
                                    <p className="text-lg text-slate-500 dark:text-slate-500 leading-relaxed">
                                        Our focus remains on practical application. By the end of this lesson, you will be able to 
                                        successfully implement these patterns in real-world scenarios, meeting all academic requirements 
                                        for the {activeModule?.title} module.
                                    </p>
                                    
                                    <div className="p-10 bg-slate-50 dark:bg-slate-900/50 rounded-[3rem] border border-slate-100 dark:border-slate-800 space-y-8">
                                        <h3 className="text-2xl font-black flex items-center gap-3">
                                            <Sparkles className="w-6 h-6 text-primary" /> Core Learning Concepts
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {[
                                                { t: "Architectural Foundations", d: "Master the primary structures used in professional systems." },
                                                { t: "Pattern Recognition", d: "Identify and apply industry-standard development patterns." },
                                                { t: "Optimization Strategy", d: "Learn to balance performance with code readability." },
                                                { t: "Risk Mitigation", d: "Understand common pitfalls and how to avoid them." }
                                            ].map((item, i) => (
                                                <div key={i} className="space-y-2">
                                                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {item.t}
                                                    </h4>
                                                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{item.d}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6 shadow-xl">
                                        <h3 className="text-lg font-black uppercase tracking-tight">Lesson Resources</h3>
                                        <div className="space-y-3">
                                            {[
                                                { n: "Course Slides", t: "PDF", i: FileText },
                                                { n: "Practice Lab", t: "Code", i: Video },
                                                { n: "Unit Assignment", t: "Submit", i: FileText }
                                            ].map((r, i) => (
                                                <button key={i} className="w-full flex items-center justify-between p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/50 transition-all group text-left">
                                                    <div className="flex items-center gap-3">
                                                        <r.i className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                                        <span className="text-xs font-bold">{r.n}</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-primary opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">{r.t}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-primary p-8 rounded-[2.5rem] text-white shadow-2xl shadow-primary/30 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />
                                        <h3 className="text-lg font-black uppercase tracking-tight relative z-10">Module Quiz</h3>
                                        <p className="text-sm font-medium opacity-80 mt-2 relative z-10">Test your knowledge of {activeModule?.title}.</p>
                                        <button className="w-full mt-6 py-4 rounded-2xl bg-white text-primary font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-105 active:scale-95 transition-all relative z-10">
                                            Start Quiz
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </article>

                        {/* Advanced Navigation Footer */}
                        <footer className="pt-16 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between pb-24">
                            <button className="flex items-center gap-4 px-8 py-4 rounded-[1.5rem] border-2 border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-all group">
                                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50">Previous Lesson</p>
                                    <p className="text-xs font-black">Architectural Intro</p>
                                </div>
                            </button>
                            <button className="flex items-center gap-6 px-12 py-5 rounded-[2rem] bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-[0.2em] text-xs shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3)] hover:scale-[1.03] active:scale-[0.97] transition-all group">
                                <span>Complete & Next Section</span>
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </footer>
                    </div>
                </div>
            </main>
        </div>
    );
}
