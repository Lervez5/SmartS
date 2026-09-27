"use client";

import { BookOpen, Settings, Layers, FileText } from "lucide-react";

const modules = [
    { id: 1, name: "Users", description: "User management, roles, and permissions", icon: BookOpen, status: "Active" },
    { id: 2, name: "Courses", description: "Course creation and curriculum management", icon: Layers, status: "Active" },
    { id: 3, name: "Cohorts", description: "Cohort scheduling and enrollment", icon: BookOpen, status: "Active" },
    { id: 4, name: "Attendance", description: "Attendance tracking and reporting", icon: BookOpen, status: "Active" },
    { id: 5, name: "Gamification", description: "Achievements, badges, and XP", icon: BookOpen, status: "Maintenance" },
];

export default function AdminModulesPage() {
    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Settings className="w-8 h-8 text-primary" />
                    System Modules
                </h1>
                <p className="text-muted-foreground mt-1">Manage system modules and view their status.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map((mod) => (
                    <div key={mod.id} className="glass rounded-[2.5rem] p-8 border border-white/20 flex flex-col items-center text-center transition-all hover:scale-[1.02]">
                        <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
                            <mod.icon className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{mod.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{mod.description}</p>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                            mod.status === "Active" 
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        }`}>
                            {mod.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
