"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, BookOpen, CalendarDays, Loader2, Search, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn, formatDate } from "@schoolos/utils";

export default function AdminCohortsPage() {
    const [cohorts, setCohorts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchCohorts();
    }, []);

    async function fetchCohorts() {
        try {
            const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
            const res = await fetch(`${API}/cohorts`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setCohorts(data.cohorts || data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }

    const filteredCohorts = cohorts.filter(c => 
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.subject?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-20">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Users className="w-8 h-8 text-primary" />
                    Cohorts
                </h1>
                <p className="text-muted-foreground mt-1">Manage student cohorts and their course assignments.</p>
            </header>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cohorts..."
                    className="w-full pl-12 pr-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm outline-none focus:border-primary transition-all shadow-sm"
                />
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : cohorts.length > 0 ? (
                <div className="space-y-4">
                    {filteredCohorts.map((cohort, i) => (
                        <motion.div
                            key={cohort.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                        >
                            <Link href={`/admin/cohorts/${cohort.id}`} className="block">
                                <div className={cn(
                                    "glass rounded-[2.5rem] p-6 border border-white/20 flex items-center justify-between gap-4 hover:border-primary/30 hover:shadow-lg transition-all group"
                                )}>
                                    <div className="flex items-center gap-5 flex-1 min-w-0">
                                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Users className="w-7 h-7 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-xl text-slate-900 dark:text-white group-hover:text-primary transition-colors">{cohort.name}</h3>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <BookOpen className="w-3.5 h-3.5" />
                                                    {cohort.subject?.name || "General"}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3.5 h-3.5" />
                                                    {cohort._count?.students || 0} students
                                                </span>
                                                {cohort.startDate && (
                                                    <span className="flex items-center gap-1">
                                                        <CalendarDays className="w-3.5 h-3.5" />
                                                        Starts {formatDate(cohort.startDate)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="glass rounded-[2.5rem] p-16 text-center border border-white/20">
                    <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-400 mb-2">No cohorts found</h3>
                    <p className="text-muted-foreground">No cohorts have been created yet.</p>
                </div>
            )}
        </div>
    );
}
