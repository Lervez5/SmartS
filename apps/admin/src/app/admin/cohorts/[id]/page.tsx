"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Users, CalendarDays, Clock, Loader2, Search, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn, formatDate } from "@schoolos/utils";

export default function AdminCohortDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const [cohort, setCohort] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        params.then((p) => fetchCohort(p.id));
    }, [params]);

    async function fetchCohort(id: string) {
        try {
            const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
            const res = await fetch(`${API}/cohorts/${id}`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setCohort(data.cohort || data || null);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!cohort) {
        return (
            <div className="text-center py-12">
                <h3 className="text-xl font-bold text-slate-400">Cohort not found</h3>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-20">
            <div className="flex items-center gap-4">
                <Link href="/admin/cohorts" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <ChevronRight className="w-5 h-5 text-slate-500 rotate-180" />
                </Link>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{cohort.name}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div className="glass p-6 rounded-[2.5rem] border border-white/20">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Subject</p>
                    <p className="font-bold text-xl text-slate-900 dark:text-white">{cohort.subject?.name || "N/A"}</p>
                </motion.div>
                <motion.div className="glass p-6 rounded-[2.5rem] border border-white/20">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Students</p>
                    <p className="font-bold text-xl text-slate-900 dark:text-white">{cohort._count?.students || 0}</p>
                </motion.div>
                <motion.div className="glass p-6 rounded-[2.5rem] border border-white/20">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Schedule</p>
                    <p className="font-bold text-xl text-slate-900 dark:text-white">{formatDate(cohort.schedule)}</p>
                </motion.div>
            </div>

            <div className="glass rounded-[2.5rem] border border-white/20 overflow-hidden">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-slate-900 dark:text-white">Students in this Cohort</h3>
                </div>
                <div className="p-4 space-y-3">
                    {(cohort.students || []).map((student: any) => (
                        <div key={student.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {student.name?.[0] || student.email?.[0]}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-slate-900 dark:text-white">{student.name || "Unnamed Student"}</p>
                                <p className="text-xs text-muted-foreground">{student.email}</p>
                            </div>
                        </div>
                    ))}
                    {(!cohort.students || cohort.students.length === 0) && (
                        <p className="text-muted-foreground text-center py-6">No students assigned to this cohort.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
