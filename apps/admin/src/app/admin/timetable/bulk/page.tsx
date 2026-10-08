"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, CheckCircle2, Download, AlertCircle } from "lucide-react";

export default function AdminTimetableBulkPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        await new Promise(r => setTimeout(r, 1500));
        setIsUploading(false);
    };

    return (
        <div className="space-y-10 pb-20 max-w-4xl mx-auto">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <Upload className="w-8 h-8 text-primary" />
                    Bulk Timetable Import
                </h1>
                <p className="text-muted-foreground mt-1">Upload a CSV file to bulk import class schedules.</p>
            </header>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-[2.5rem] p-8 border border-white/20"
            >
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem] p-8 text-center">
                    <Upload className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <input
                        type="file"
                        accept=".csv,.xls,.xlsx"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer inline-flex flex-col items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">Choose CSV File</span>
                        <span className="text-xs text-muted-foreground">{file?.name || "No file selected"}</span>
                    </label>
                </div>

                <div className="mt-6 space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            Make sure your CSV has columns: Day, Time, Subject, Room, Teacher, Class/Cohort, Semester
                        </p>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                            Imported schedules will automatically appear on each teacher's personal calendar.
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex justify-between items-center">
                    <a href="/admin/timetable/template.csv" className="flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                        <Download className="w-4 h-4" />
                        Download Template
                    </a>
                    <button
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                    >
                        {isUploading ? "Importing..." : "Import Timetable"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
