export const dynamic = "force-dynamic";

import { StudentView } from "@/features/dashboard/components/student-view";
import { BookOpen, Search, Filter } from "lucide-react";

export default function LessonsPage() {
    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-primary" />
                        My Learning Journey
                    </h1>
                    <p className="text-muted-foreground mt-1">Explore and master new subjects at your own pace like a pro!</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Find a lesson..."
                            className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-primary transition-all w-64"
                        />
                    </div>
                    <button className="glass p-2 rounded-xl text-slate-600 hover:text-primary transition-colors">
                        <Filter className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Subject Cards - Interactive like w3schools */}
                {['Mathematics', 'Science', 'English', 'History', 'Art', 'Geography'].map((subject, idx) => (
                    <div key={subject} className="glass rounded-[2rem] p-6 group hover:scale-[1.02] transition-all cursor-pointer border-t-4 border-primary/20">
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl`}>
                                {subject[0]}
                            </div>
                            <span className="text-xs font-bold px-3 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">{subject}</h3>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">Master the core concepts of {subject} with interactive lessons and fun quizzes.</p>

                        <div className="mt-6 space-y-3">
                            <div className="flex items-center justify-between text-xs font-semibold">
                                <span>Progress</span>
                                <span>{20 + (idx * 15)}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-1000"
                                    style={{ width: `${20 + (idx * 15)}%` }}
                                />
                            </div>
                        </div>

                        <button className="w-full mt-6 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 group-hover:bg-primary transition-colors">
                            Continue Learning
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
