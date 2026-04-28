"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
    ShieldCheck, BookOpen, User, 
    Layers, Tag, Save, X, Sparkles 
} from "lucide-react";
import { useCreateCourse } from "@/hooks/use-courses";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function CourseShellForm() {
    const router = useRouter();
    const create = useCreateCourse();
    
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        subjectId: "S1", // Placeholder
        teacherId: "",   // Must select a teacher
        category: "Primary",
        learningObjectives: [""]
    });

    const handleSave = () => {
        if (!formData.title || !formData.teacherId) {
            alert("Please provide a title and assign a teacher.");
            return;
        }
        create.mutate(formData, {
            onSuccess: () => {
                router.push("/admin/metrics"); // Or back to courses
            }
        });
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <header className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Initialize Course Shell</h2>
                        <p className="text-xs text-slate-500 font-bold">Admin-level curriculum provisioning</p>
                    </div>
                </div>
                <button 
                    onClick={() => router.back()}
                    className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </header>

            <div className="glass p-8 rounded-[2.5rem] border border-white/20 shadow-2xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                
                <div className="space-y-4 relative z-10">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Course Title</label>
                        <div className="relative">
                            <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                placeholder="e.g. Advanced Mathematics for Kids"
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Subject</label>
                            <div className="relative">
                                <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select 
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                                    value={formData.subjectId}
                                    onChange={(e) => setFormData({...formData, subjectId: e.target.value})}
                                >
                                    <option value="S1">Mathematics</option>
                                    <option value="S2">Science</option>
                                    <option value="S3">Languages</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Assigned Teacher</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Teacher ID"
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={formData.teacherId}
                                    onChange={(e) => setFormData({...formData, teacherId: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Description</label>
                        <textarea 
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            placeholder="Provide a brief overview of the learning journey..."
                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                <div className="pt-4 relative z-10">
                    <button 
                        onClick={handleSave}
                        disabled={create.isPending}
                        className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    >
                        {create.isPending ? <Sparkles className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {create.isPending ? "Provisioning..." : "Provision Course"}
                    </button>
                </div>
            </div>
        </div>
    );
}
