"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useCreateCourse } from "@schoolos/hooks";

const inputClass = "w-full bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200 dark:border-slate-700 focus:border-primary/60 focus:ring-2 focus:ring-primary/10 rounded-2xl py-4 px-6 outline-none transition-all shadow-sm font-medium";
const labelClass = "text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1";

export default function NewCoursePage() {
    const router = useRouter();
    const { mutateAsync: createCourse, isPending } = useCreateCourse();
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", category: "Software Development" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            await createCourse(form);
            setSuccess(true);
            setTimeout(() => router.push("/admin"), 1200);
        } catch (err: any) {
            setError(err?.response?.data?.message || "Failed to create course");
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-12 px-4 space-y-8">
            <Link href="/admin" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-[2.5rem] p-8 md:p-12 border border-white/20 dark:border-white/10"
            >
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Create Course</h1>
                        <p className="text-sm text-muted-foreground font-medium">Add a new course to the curriculum.</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl text-sm font-bold">{error}</div>
                )}

                {success ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-500 mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Course Created!</h2>
                        <p className="text-muted-foreground">Redirecting to the admin dashboard...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className={labelClass}>Course Title</label>
                            <input
                                type="text"
                                required
                                value={form.title}
                                onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                                placeholder="Introduction to Web Development"
                                className={inputClass}
                                disabled={isPending}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className={labelClass}>Description</label>
                            <textarea
                                rows={4}
                                value={form.description}
                                onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                                placeholder="What will students learn?"
                                className={`${inputClass} resize-none`}
                                disabled={isPending}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className={labelClass}>Category</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
                                className={inputClass}
                                disabled={isPending}
                            >
                                <option>Software Development</option>
                                <option>Artificial Intelligence</option>
                                <option>Personal Development</option>
                                <option>Blockchain</option>
                            </select>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                            >
                                {isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create Course"}
                            </button>
                        </div>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
