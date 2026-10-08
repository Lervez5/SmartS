"use client";

import { BarChart3, TrendingUp, ShoppingBag, DollarSign, Users, BookOpen, Shield } from "lucide-react";

const reportCards = [
    { title: "Monthly Activity", description: "Overview of user activity and engagement over the past month.", icon: BarChart3, color: "from-blue-500 to-indigo-600" },
    { title: "Revenue Summary", description: "Financial overview including subscription revenue and expenses.", icon: DollarSign, color: "from-emerald-500 to-teal-600" },
    { title: "Course Performance", description: "Performance metrics across all courses and modules.", icon: BookOpen, color: "from-purple-500 to-fuchsia-600" },
    { title: "Cohort Analytics", description: "Detailed analysis of cohort engagement and outcomes.", icon: Users, color: "from-amber-500 to-orange-600" },
];

export default function AdminReportingPage() {
    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <ShoppingBag className="w-8 h-8 text-primary" />
                    Reporting & Analytics
                </h1>
                <p className="text-muted-foreground mt-1">Generate detailed reports and gain insights into your school's performance.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {reportCards.map((card, i) => (
                    <div key={i} className="glass rounded-[2.5rem] p-8 border border-white/20 flex flex-col items-center text-center group hover:scale-[1.03] transition-all cursor-pointer">
                        <div className={`w-16 h-16 rounded-3xl bg-gradient-to-br ${card.color} flex items-center justify-center text-white mb-6 shadow-lg`}>
                            <card.icon className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary transition-colors">{card.title}</h3>
                        <p className="text-sm text-muted-foreground">{card.description}</p>
                    </div>
                ))}
            </div>

            <div className="glass rounded-[2.5rem] p-8 border border-white/20">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Report Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Date Range</label>
                        <select className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm font-bold outline-none focus:border-primary transition-all">
                            <option>Last 30 days</option>
                            <option>Last 90 days</option>
                            <option>This year</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Report Type</label>
                        <select className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm font-bold outline-none focus:border-primary transition-all">
                            <option>Activity Report</option>
                            <option>Performance Report</option>
                            <option>Financial Report</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Format</label>
                        <select className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm font-bold outline-none focus:border-primary transition-all">
                            <option>Web View</option>
                            <option>PDF Export</option>
                            <option>CSV Export</option>
                        </select>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button className="px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-primary/20">
                        Generate Report
                    </button>
                </div>
            </div>
        </div>
    );
}
