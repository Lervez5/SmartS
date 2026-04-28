"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Plus, Video, FileText, File, ListTree, Settings, 
    Save, Trash2, GripVertical, ChevronDown, ChevronUp,
    Layout, BookOpen, Target, Sparkles, Lock, Unlock,
    Layers, ChevronRight, Eye, MoreVertical, X, Edit3
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useCreateCourse, useUpdateCourse, useCourseDetails } from "@/hooks/use-courses";
import { useAuthStore } from "@/store/auth.store";

interface Lesson {
    id: string;
    title: string;
    type: "video" | "pdf" | "note";
    content: string;
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

function ContentEditorModal({ lesson, onSave, onClose }: { lesson: Lesson, onSave: (content: string) => void, onClose: () => void }) {
    const [content, setContent] = useState(lesson.content || "");

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col h-[80vh]">
                <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Lesson Content</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{lesson.title}</p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </header>
                <div className="flex-1 p-8 overflow-hidden flex flex-col gap-4">
                    <div className="flex-1 rounded-3xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 p-6">
                        <textarea 
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-full bg-transparent border-none outline-none font-medium text-slate-700 dark:text-slate-300 resize-none custom-scrollbar leading-relaxed"
                            placeholder="Type your lesson content here (Markdown supported)..."
                        />
                    </div>
                    <div className="flex items-center justify-between px-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Markdown Engine Active</p>
                        <button 
                            onClick={() => { onSave(content); onClose(); }}
                            className="px-10 py-4 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                        >
                            Sync Content
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export function CourseEditor({ courseId }: { courseId?: string }) {
    const { user } = useAuthStore();
    const create = useCreateCourse();
    const update = useUpdateCourse();
    
    const { data: existingCourse, isLoading } = useCourseDetails(courseId || "");
    
    const [title, setTitle] = useState("New Sprout Course");
    const [subjectId, setSubjectId] = useState("");
    const [modules, setModules] = useState<Module[]>([
        { 
            id: "m1", 
            title: "Introduction", 
            isLocked: false,
            units: [
                { 
                    id: "u1", 
                    title: "Welcome Unit", 
                    lessons: [{ id: "l1", title: "Welcome Video", type: "video", content: "" }] 
                }
            ] 
        }
    ]);
    const [activeTab, setActiveTab] = useState<"content" | "settings" | "objectives">("content");
    const [expandedModuleId, setExpandedModuleId] = useState<string | null>("m1");
    const [editingLesson, setEditingLesson] = useState<{ mIdx: number, uIdx: number, lIdx: number } | null>(null);

    useEffect(() => {
        if (existingCourse) {
            setTitle(existingCourse.title);
            setSubjectId(existingCourse.subjectId);
            if (existingCourse.modules?.length > 0) {
                setModules(existingCourse.modules.map((m: any) => ({
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
                            content: l.content || ""
                        }))
                    }))
                })));
            }
        }
    }, [existingCourse]);

    const handleSave = () => {
        if (!subjectId) {
            alert("Please select a subject (Module) for this course first in Settings.");
            setActiveTab("settings");
            return;
        }

        const payload = {
            title,
            subjectId,
            teacherId: user?.id,
            status: "published",
            modules: modules.map(m => ({
                title: m.title,
                status: m.isLocked ? "locked" : "published",
                units: m.units.map(u => ({
                    title: u.title,
                    lessons: u.lessons.map(l => ({ 
                        title: l.title, 
                        lessonType: l.type,
                        content: l.content || "",
                        subjectId
                    }))
                }))
            }))
        };
        
        if (courseId) {
            update.mutate({ id: courseId, data: payload });
        } else {
            create.mutate(payload);
        }
    };

    const addModule = () => {
        const newId = `m${Date.now()}`;
        setModules([...modules, { id: newId, title: "New Module", isLocked: false, units: [] }]);
        setExpandedModuleId(newId);
    };

    const addUnit = (moduleId: string) => {
        setModules(modules.map(m => m.id === moduleId ? {
            ...m,
            units: [...m.units, { id: `u${Date.now()}`, title: "New Unit", lessons: [] }]
        } : m));
    };

    const addLesson = (moduleId: string, unitId: string, type: Lesson["type"]) => {
        setModules(modules.map(m => m.id === moduleId ? {
            ...m,
            units: m.units.map(u => u.id === unitId ? {
                ...u,
                lessons: [...u.lessons, { id: `l${Date.now()}`, title: `New ${type}`, type, content: "" }]
            } : u)
        } : m));
    };

    const updateLessonContent = (mIdx: number, uIdx: number, lIdx: number, content: string) => {
        const newModules = [...modules];
        newModules[mIdx].units[uIdx].lessons[lIdx].content = content;
        setModules(newModules);
    };

    if (courseId && isLoading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="w-full space-y-10 pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.3em]">
                        <Layout className="w-4 h-4" /> Curriculum Architect
                    </div>
                    <input 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="text-3xl md:text-5xl font-black bg-transparent outline-none border-none placeholder:text-slate-200 dark:placeholder:text-slate-800 w-full tracking-tight"
                        placeholder="Enter Course Title..."
                    />
                </div>
                
                <div className="flex items-center gap-3 self-end md:self-center">
                    <button className="flex items-center gap-2 px-6 py-4 rounded-[1.5rem] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-200 dark:border-slate-800">
                        <Eye className="w-4 h-4" /> Preview
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={create.isPending || update.isPending}
                        className="flex items-center gap-3 px-10 py-4 rounded-[1.5rem] bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(59,130,246,0.3)] hover:scale-[1.03] active:scale-[0.97] transition-all disabled:opacity-50"
                    >
                        {create.isPending || update.isPending ? <Sparkles className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {create.isPending || update.isPending ? "Syncing..." : "Publish Curriculum"}
                    </button>
                </div>
            </header>

            <div className="flex flex-col xl:flex-row gap-10">
                <aside className="w-full xl:w-80 space-y-6 shrink-0">
                    <div className="glass rounded-[2.5rem] border border-white/20 p-4 space-y-2">
                        {[
                            { id: "content", label: "Curriculum Builder", icon: ListTree },
                            { id: "objectives", label: "Learning Outcomes", icon: Target },
                            { id: "settings", label: "Course Settings", icon: Settings },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[13px] font-black uppercase tracking-tight transition-all",
                                    activeTab === tab.id 
                                        ? "bg-slate-900 text-white shadow-xl dark:bg-white dark:text-slate-900" 
                                        : "text-slate-500 hover:bg-white/60 dark:hover:bg-slate-800/60"
                                )}
                            >
                                <tab.icon className="w-5 h-5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Builder Stats</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-2xl font-black">{modules.length}</p>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Modules</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-2xl font-black">{modules.reduce((a, m) => a + m.units.length, 0)}</p>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Units</p>
                            </div>
                        </div>
                    </div>
                </aside>

                <div className="flex-1 space-y-10 min-w-0">
                    {activeTab === "content" && (
                        <div className="space-y-8">
                            <AnimatePresence mode="popLayout">
                                {modules.map((module, mIdx) => (
                                    <motion.div 
                                        key={module.id}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="glass rounded-[3.5rem] border border-white/20 shadow-2xl overflow-hidden"
                                    >
                                        <div className="p-8 md:p-10 bg-white/40 dark:bg-slate-900/40 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="flex items-center gap-6 flex-1">
                                                <div className="w-14 h-14 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary font-black text-sm shadow-inner">
                                                    M{(mIdx + 1)}
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <input 
                                                        value={module.title}
                                                        onChange={(e) => {
                                                            const nm = [...modules];
                                                            nm[mIdx].title = e.target.value;
                                                            setModules(nm);
                                                        }}
                                                        className="w-full text-2xl font-black bg-transparent border-none outline-none tracking-tight"
                                                        placeholder="Module Title..."
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button 
                                                    onClick={() => {
                                                        const nm = [...modules];
                                                        nm[mIdx].isLocked = !nm[mIdx].isLocked;
                                                        setModules(nm);
                                                    }}
                                                    className={cn(
                                                        "flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all",
                                                        module.isLocked ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                                                    )}
                                                >
                                                    {module.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                                    {module.isLocked ? "Locked" : "Free"}
                                                </button>
                                                <button 
                                                    onClick={() => setExpandedModuleId(expandedModuleId === module.id ? null : module.id)}
                                                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 transition-all"
                                                >
                                                    <ChevronDown className={cn("w-5 h-5 transition-transform", expandedModuleId === module.id && "rotate-180")} />
                                                </button>
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {expandedModuleId === module.id && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="p-8 md:p-10 pt-0 space-y-10">
                                                    <div className="space-y-6 pt-10">
                                                        {module.units.map((unit, uIdx) => (
                                                            <div key={unit.id} className="bg-white/30 dark:bg-slate-900/30 rounded-[2.5rem] border border-white/10 p-6 md:p-8 space-y-6 shadow-sm">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-4">
                                                                        <Layers className="w-5 h-5 text-slate-400" />
                                                                        <input 
                                                                            value={unit.title}
                                                                            onChange={(e) => {
                                                                                const nm = [...modules];
                                                                                nm[mIdx].units[uIdx].title = e.target.value;
                                                                                setModules(nm);
                                                                            }}
                                                                            className="font-black text-sm uppercase tracking-widest bg-transparent border-none outline-none"
                                                                            placeholder="Unit Title..."
                                                                        />
                                                                    </div>
                                                                    <button className="p-2 text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    {unit.lessons.map((lesson, lIdx) => (
                                                                        <div key={lesson.id} className="flex items-center justify-between p-4 bg-white/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 group hover:border-primary/30 transition-all">
                                                                            <div className="flex items-center gap-4 flex-1">
                                                                                <div className={cn(
                                                                                    "w-10 h-10 rounded-xl flex items-center justify-center",
                                                                                    lesson.type === "video" ? "bg-blue-100 text-blue-600" :
                                                                                    lesson.type === "pdf" ? "bg-rose-100 text-rose-600" :
                                                                                    "bg-emerald-100 text-emerald-600"
                                                                                )}>
                                                                                    {lesson.type === "video" ? <Video className="w-5 h-5" /> :
                                                                                     lesson.type === "pdf" ? <FileText className="w-5 h-5" /> :
                                                                                     <BookOpen className="w-5 h-5" />}
                                                                                </div>
                                                                                <input 
                                                                                    value={lesson.title}
                                                                                    onChange={(e) => {
                                                                                        const nm = [...modules];
                                                                                        nm[mIdx].units[uIdx].lessons[lIdx].title = e.target.value;
                                                                                        setModules(nm);
                                                                                    }}
                                                                                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
                                                                                    placeholder="Lesson Title..."
                                                                                />
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <button 
                                                                                    onClick={() => setEditingLesson({ mIdx, uIdx, lIdx })}
                                                                                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary transition-all flex items-center gap-2"
                                                                                >
                                                                                    <Edit3 className="w-4 h-4" />
                                                                                    <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Content</span>
                                                                                </button>
                                                                                <button className="p-2.5 rounded-xl text-rose-400 hover:bg-rose-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    
                                                                    <div className="flex items-center justify-center gap-6 pt-4">
                                                                        {[{ t: "video", i: Video, l: "+ Video" }, { t: "pdf", i: FileText, l: "+ PDF" }, { t: "note", i: BookOpen, l: "+ Note" }].map((btn) => (
                                                                            <button 
                                                                                key={btn.t}
                                                                                onClick={() => addLesson(module.id, unit.id, btn.t as any)}
                                                                                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-all"
                                                                            >
                                                                                <btn.i className="w-3.5 h-3.5" /> {btn.l}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        
                                                        <button 
                                                            onClick={() => addUnit(module.id)}
                                                            className="w-full py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex items-center justify-center gap-3 text-slate-400 hover:border-primary hover:text-primary transition-all group"
                                                        >
                                                            <Plus className="w-5 h-5" />
                                                            <span className="font-black text-xs uppercase tracking-widest">Add New Unit</span>
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            <button onClick={addModule} className="w-full py-12 bg-white/20 dark:bg-slate-900/20 border-4 border-dashed border-slate-200 dark:border-slate-800 rounded-[4rem] flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-primary/50 hover:text-primary transition-all group">
                                <Plus className="w-8 h-8" />
                                <span className="font-black text-sm uppercase tracking-[0.4em]">New Module</span>
                            </button>
                        </div>
                    )}

                    {activeTab === "settings" && (
                        <div className="glass p-12 rounded-[4rem] border border-white/20 shadow-2xl space-y-10">
                            <div className="space-y-6">
                                <h3 className="text-3xl font-black tracking-tight">Classification</h3>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Parent Module (Subject)</label>
                                    <input 
                                        value={subjectId}
                                        onChange={(e) => setSubjectId(e.target.value)}
                                        placeholder="Enter the Subject ID this course belongs to..."
                                        className="w-full px-8 py-5 rounded-[2rem] bg-slate-50 dark:bg-slate-950/50 border-none focus:ring-2 focus:ring-primary/50 font-bold"
                                    />
                                    <p className="text-[10px] text-slate-400 font-medium ml-4">This links the course to the Reporting Center filtering system.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "objectives" && (
                        <div className="glass p-12 rounded-[4rem] border border-white/20 shadow-2xl space-y-10">
                            <h3 className="text-3xl font-black tracking-tight">Outcomes</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="flex items-center gap-5 p-6 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border border-white/10">
                                        <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center text-xs font-black shadow-lg shadow-primary/20">{i}</div>
                                        <input className="flex-1 bg-transparent border-none outline-none font-bold text-sm" placeholder="Outcome description..." />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {editingLesson && (
                    <ContentEditorModal 
                        lesson={modules[editingLesson.mIdx].units[editingLesson.uIdx].lessons[editingLesson.lIdx]} 
                        onSave={(content) => updateLessonContent(editingLesson.mIdx, editingLesson.uIdx, editingLesson.lIdx, content)}
                        onClose={() => setEditingLesson(null)} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
