"use client";

import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Users, BookOpen, Award } from "lucide-react";

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.07 } } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } },
};

export default function AdminMetricsPage() {
    const stats = [
        { label: "Total Users", value: "1,234", icon: Users, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
        { label: "Active Courses", value: "56", icon: BookOpen, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
        { label: "Completion Rate", value: "87%", icon: TrendingUp, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
        { label: "Avg. Score", value: "92.4", icon: Award, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/30" },
    ];

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-primary" />
                    Metrics Dashboard
                </h1>
                <p className="text-muted-foreground mt-1">School-wide analytics and performance metrics.</p>
            </header>

            <motion.div 
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
                initial="initial"
                animate="animate"
                variants={stagger.container}
            >
                {stats.map((s, i) => (
                    <motion.div
                        key={i}
                        variants={stagger.item}
                        className="glass p-6 rounded-[2rem] border border-white/20 flex items-center gap-4"
                    >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${s.bg}`}>
                            <s.icon className={`w-6 h-6 ${s.color}`} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{s.value}</p>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass rounded-[2.5rem] p-8 border border-white/20">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Subject Performance</h3>
                    <div className="space-y-4">
                        {["Mathematics", "Science", "English", "History"].map((subject, i) => (
                            <div key={subject} className="space-y-2">
                                <div className="flex justify-between text-sm font-bold">
                                    <span className="text-slate-700 dark:text-slate-300">{subject}</span>
                                    <span className="text-slate-900 dark:text-white">{75 + i * 5}%</span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-primary rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${75 + i * 5}%` }}
                                        transition={{ delay: i * 0.1 + 0.3 }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass rounded-[2.5rem] p-8 border border-white/20">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Enrollment by Role</h3>
                    <div className="space-y-4">
                        {[
                            { role: "Students", count: 892, pct: 72 },
                            { role: "Teachers", count: 67, pct: 5 },
                            { role: "Parents", count: 168, pct: 14 },
                            { role: "Admins", count: 8, pct: 9 },
                        ].map((item, i) => (
                            <div key={item.role} className="flex items-center gap-4">
                                <span className="w-20 text-sm font-bold text-slate-700 dark:text-slate-300">{item.role}</span>
                                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-primary rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${item.pct}%` }}
                                        transition={{ delay: i * 0.1 + 0.3 }}
                                    />
                                </div>
                                <span className="w-12 text-right text-sm font-black text-slate-900 dark:text-white">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
