"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Users, BookOpen, TrendingUp, Calendar, ChevronRight, 
    MoreVertical, Plus, Search, Filter, Sparkles, Layout,
    CheckCircle2, Clock, MessageCircle, Trophy, BarChart3,
    X, Upload, UserPlus, Info, Check, AlertCircle, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllCohorts, useUpdateCohort } from "@/hooks/use-cohorts";
import { useCourses } from "@/hooks/use-courses";
import { useSubjects } from "@/hooks/use-subjects";
import { useTeachers } from "@/hooks/use-users";
import Link from "next/link";
import axios from "axios";

// --- Create Cohort Modal ---
function CreateCohortModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: (cohortId: string) => void }) {
    const { data: subjects } = useSubjects();
    const { data: teachers } = useTeachers();
    const { data: courses } = useCourses();
    
    const [formData, setFormData] = useState({
        name: "",
        subjectId: "",
        teacherId: "",
        courseId: "",
        description: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await axios.post("http://localhost:4000/api/classes", formData, { withCredentials: true });
            onSuccess(res.data.id);
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">New Intake Cohort</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Initialize a new student group</p>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Cohort Name</label>
                        <input 
                            required
                            placeholder="e.g., February 2025 Cohort VII"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Main Subject</label>
                            <select 
                                required
                                value={formData.subjectId}
                                onChange={(e) => setFormData({...formData, subjectId: e.target.value})}
                                className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                            >
                                <option value="">Select Subject</option>
                                {subjects?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Lead Teacher</label>
                            <select 
                                required
                                value={formData.teacherId}
                                onChange={(e) => setFormData({...formData, teacherId: e.target.value})}
                                className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                            >
                                <option value="">Select Teacher</option>
                                {teachers?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Linked Curriculum (Course)</label>
                        <select 
                            required
                            value={formData.courseId}
                            onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                        >
                            <option value="">Select Curriculum</option>
                            {courses?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-4">Cohort Description</label>
                        <textarea 
                            rows={3}
                            placeholder="Briefly describe the cohort goals..."
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                        />
                    </div>

                    <button 
                        disabled={isSubmitting}
                        className="w-full py-5 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? "Creating..." : "Initialize Cohort"}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}

// --- Bulk Import Modal ---
function BulkImportModal({ isOpen, cohortId, onClose, onSuccess }: { isOpen: boolean, cohortId: string | null, onClose: () => void, onSuccess: () => void }) {
    const [emails, setEmails] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleImport = async () => {
        if (!cohortId) return;
        setIsSubmitting(true);
        try {
            const emailList = emails.split("\n").map(e => e.trim()).filter(e => e.includes("@"));
            const res = await axios.post(`http://localhost:4000/api/classes/${cohortId}/enroll-bulk`, { emails: emailList }, { withCredentials: true });
            setResult(res.data);
            onSuccess();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col">
                <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <UserPlus className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Bulk Enrollment</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Add students to cohort</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="p-8 space-y-6">
                    {!result ? (
                        <>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Enter Student Emails (one per line)
                                </label>
                                <textarea 
                                    rows={8}
                                    placeholder="student1@example.com&#10;student2@example.com"
                                    value={emails}
                                    onChange={(e) => setEmails(e.target.value)}
                                    className="w-full px-6 py-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                />
                            </div>

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 flex gap-3">
                                <Info className="w-5 h-5 text-blue-500 shrink-0" />
                                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 leading-relaxed uppercase tracking-tight">
                                    Only existing students in the system will be enrolled. Invitations will be sent to new emails.
                                </p>
                            </div>

                            <button 
                                onClick={handleImport}
                                disabled={isSubmitting || !emails.trim()}
                                className="w-full py-5 rounded-2xl bg-slate-900 dark:bg-primary text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? "Processing..." : "Enroll Students"}
                            </button>
                        </>
                    ) : (
                        <div className="space-y-8 py-4">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                                    <Check className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Import Complete</h3>
                                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Summary of enrollment actions</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-center">
                                    <p className="text-3xl font-black text-emerald-600">{result.enrolledCount}</p>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Successfully Enrolled</p>
                                </div>
                                <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-center">
                                    <p className="text-3xl font-black text-amber-600">{result.invitedCount}</p>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Invitations Sent</p>
                                </div>
                            </div>

                            <button onClick={onClose} className="w-full py-5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-[0.2em] transition-all">
                                Close Window
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

export default function AdminCohortManager() {
    const { data: cohorts, isLoading: cohortsLoading, refetch } = useAllCohorts();
    const [searchQuery, setSearchQuery] = useState("");
    
    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);

    const filteredCohorts = cohorts?.filter((c: any) => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCreateSuccess = (id: string) => {
        setSelectedCohortId(id);
        refetch();
        setIsImportModalOpen(true);
    };

    if (cohortsLoading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="w-full space-y-10 pb-20">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[0.3em] mb-2">
                        <Users className="w-4 h-4" /> Platform Administration
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Global Cohort Manager</h1>
                    <p className="text-slate-500 font-medium mt-1">Manage global student intakes, academic classifications, and curriculum linkages.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-6 py-4 rounded-[1.5rem] bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all border border-slate-200 dark:border-slate-800">
                        <Filter className="w-4 h-4" /> Filter Intakes
                    </button>
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-3 px-8 py-4 rounded-[1.5rem] bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.03] active:scale-[0.97] transition-all"
                    >
                        <Plus className="w-4 h-4" /> Create Cohort
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <aside className="lg:col-span-1 space-y-6">
                    <div className="glass p-6 rounded-[2.5rem] border border-white/20 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Search cohorts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Students Managed</p>
                            <p className="text-4xl font-black">{cohorts?.reduce((a: number, c: any) => a + (c._count?.enrollments || 0), 0)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-xl font-black">{cohorts?.length}</p>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active Cohorts</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xl font-black">94%</p>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Avg Attendance</p>
                            </div>
                        </div>
                    </div>
                </aside>

                <div className="lg:col-span-3 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AnimatePresence mode="popLayout">
                            {filteredCohorts?.map((cohort: any, i: number) => (
                                <motion.div 
                                    key={cohort.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="glass rounded-[3rem] border border-white/20 overflow-hidden hover:shadow-2xl transition-all group"
                                >
                                    <div className="p-8 space-y-6">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest w-fit">
                                                    {cohort.subject?.name}
                                                </div>
                                                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-2">{cohort.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => { setSelectedCohortId(cohort.id); setIsImportModalOpen(true); }}
                                                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary transition-all shadow-sm"
                                                    title="Bulk Enroll"
                                                >
                                                    <UserPlus className="w-5 h-5" />
                                                </button>
                                                <button className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 py-4 border-y border-slate-100 dark:border-white/5">
                                            <div className="flex -space-x-3">
                                                {[1,2,3].map(j => (
                                                    <div key={j} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200" />
                                                ))}
                                                <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-900 text-[8px] flex items-center justify-center text-white font-black">
                                                    +{cohort._count?.enrollments}
                                                </div>
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Active Students
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-500">
                                                <span>Curriculum Progress</span>
                                                <span className="text-primary">78%</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                <div className="h-full bg-primary rounded-full" style={{ width: "78%" }} />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                                                <span className="text-xs font-bold text-slate-500 truncate">
                                                    {cohort.course?.title || "No curriculum linked"}
                                                </span>
                                            </div>
                                            <Link 
                                                href={`/admin/cohorts/${cohort.id}`}
                                                className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shadow-sm shrink-0"
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="border-4 border-dashed border-slate-100 dark:border-white/5 rounded-[3rem] p-10 flex flex-col items-center justify-center gap-4 text-slate-300 hover:border-primary/30 hover:text-primary transition-all group"
                        >
                            <Plus className="w-10 h-10 group-hover:scale-110 transition-transform" />
                            <span className="font-black text-xs uppercase tracking-[0.4em]">New Intake Cohort</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <CreateCohortModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
                onSuccess={handleCreateSuccess}
            />
            <BulkImportModal 
                isOpen={isImportModalOpen} 
                cohortId={selectedCohortId}
                onClose={() => { setIsImportModalOpen(false); setSelectedCohortId(null); }}
                onSuccess={refetch}
            />
        </div>
    );
}
