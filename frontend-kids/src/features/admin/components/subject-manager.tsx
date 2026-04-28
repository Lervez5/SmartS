"use client";

import React, { useState } from "react";
import { Plus, Trash2, Search, BookOpen, Layers, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSubjects } from "@/hooks/use-subjects";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";

const API = "http://localhost:4000/api";

export function SubjectManager() {
    const { data: subjects, isLoading } = useSubjects();
    const [newSubject, setNewSubject] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const queryClient = useQueryClient();

    const handleCreateSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSubject.trim()) return;

        setIsSubmitting(true);
        try {
            await axios.post(`${API}/subjects`, { name: newSubject }, { withCredentials: true });
            setNewSubject("");
            queryClient.invalidateQueries({ queryKey: ["subjects"] });
        } catch (err) {
            console.error("Failed to create subject", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Module Management</h1>
                    <p className="text-slate-500 font-medium">Create and manage top-level course categories (Subjects).</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Create Section */}
                <div className="glass p-8 rounded-[2.5rem] border border-white/20 shadow-xl h-fit space-y-6">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <Plus className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black uppercase tracking-tight">New Module</h2>
                    </div>
                    
                    <form onSubmit={handleCreateSubject} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Module Name</label>
                            <input 
                                type="text"
                                value={newSubject}
                                onChange={(e) => setNewSubject(e.target.value)}
                                placeholder="e.g. AI & Machine Learning"
                                className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-none focus:ring-2 focus:ring-primary/50 font-bold outline-none transition-all"
                            />
                        </div>
                        <button 
                            disabled={isSubmitting}
                            className="w-full py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? "Creating..." : "Create Module"}
                        </button>
                    </form>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 glass p-8 rounded-[2.5rem] border border-white/20 shadow-xl min-h-[400px] space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                <Layers className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-black uppercase tracking-tight">Existing Modules</h2>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search modules..."
                                className="pl-12 pr-6 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border-none text-xs font-bold outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AnimatePresence>
                            {subjects?.map((subject: any) => (
                                <motion.div 
                                    key={subject.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="p-5 rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-primary/30 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                            <BookOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white">{subject.name}</h3>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {subject.id.slice(-6)}</p>
                                        </div>
                                    </div>
                                    <button className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {subjects?.length === 0 && (
                            <div className="col-span-2 flex flex-col items-center justify-center py-20 space-y-4">
                                <Sparkles className="w-12 h-12 text-slate-200" />
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No modules created yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
