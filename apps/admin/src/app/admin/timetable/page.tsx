"use client";

import { Calendar, Upload, FileText, CheckCircle2 } from "lucide-react";

const timetableEntries = [
    { day: "Monday", time: "09:00 - 10:30", subject: "Mathematics", room: "Room 101", teacher: "Ms. Johnson" },
    { day: "Monday", time: "11:00 - 12:30", subject: "Science", room: "Lab B", teacher: "Dr. Smith" },
    { day: "Tuesday", time: "09:00 - 10:30", subject: "English", room: "Room 203", teacher: "Mr. Brown" },
    { day: "Wednesday", time: "14:00 - 15:30", subject: "History", room: "Room 105", teacher: "Ms. Davis" },
];

export default function AdminTimetablePage() {
    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-primary" />
                        School Timetable
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage the school-wide timetable and class schedules.</p>
                </div>
                <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
                    <Upload className="w-5 h-5" />
                    Bulk Import
                </button>
            </header>

            <div className="glass rounded-[2.5rem] border border-white/20 overflow-hidden">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-6 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <div className="col-span-1">Day</div>
                        <div className="col-span-2">Time</div>
                        <div className="col-span-1">Subject</div>
                        <div className="col-span-1">Room</div>
                        <div className="col-span-1">Teacher</div>
                        <div className="col-span-0"></div>
                    </div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {timetableEntries.map((entry, i) => (
                        <div key={i} className="p-4 grid grid-cols-6 gap-4 items-center hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors">
                            <div className="col-span-1 font-bold text-slate-900 dark:text-white">{entry.day}</div>
                            <div className="col-span-2 text-sm text-slate-600 dark:text-slate-400">{entry.time}</div>
                            <div className="col-span-1 font-medium text-slate-900 dark:text-white">{entry.subject}</div>
                            <div className="col-span-1 text-sm text-slate-600 dark:text-slate-400">{entry.room}</div>
                            <div className="col-span-1 text-sm text-slate-600 dark:text-slate-400">{entry.teacher}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass rounded-[2.5rem] p-8 border border-white/20">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-primary" />
                    Bulk Import Instructions
                </h3>
                <div className="space-y-4 text-sm text-muted-foreground">
                    <p>Upload a CSV file with the following columns:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                        {["Day", "Time", "Subject", "Room", "Teacher", "Class/Cohort", "Semester"].map(col => (
                            <span key={col} className="px-3 py-2 bg-white dark:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300">
                                {col}
                            </span>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        When imported, schedules will automatically appear on each teacher's personal calendar.
                    </div>
                </div>
            </div>
        </div>
    );
}
