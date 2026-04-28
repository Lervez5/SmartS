"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
    ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
    Loader2, X, Info, Download, Clock, CalendarDays,
} from "lucide-react";
import axios from "axios";
import { cn } from "@/lib/utils";

const API = "http://localhost:4000/api";
const cfg = { withCredentials: true };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface TimetableRow {
    className: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
    recurrence: string;
    validFrom: string;
    validUntil?: string;
    // parsed state
    _status?: "valid" | "error";
    _error?: string;
}

const EXAMPLE_CSV = `className,dayOfWeek,startTime,endTime,room,recurrence,validFrom,validUntil
Mathematics 10A,1,08:00,09:00,Room 12,weekly,2025-09-01,2026-06-30
Science 9B,2,10:00,11:00,Lab 3,weekly,2025-09-01,2026-06-30
English 8C,3,09:00,10:00,Room 5,weekly,2025-09-01,
Physics 11A,4,13:00,14:30,Lab 1,weekly,2025-09-01,2026-06-30`;

function parseCSV(text: string): TimetableRow[] {
    const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim());
        const row: any = {};
        headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });

        const errors: string[] = [];
        if (!row.className)          errors.push("className required");
        const day = parseInt(row.dayOfWeek);
        if (isNaN(day) || day < 0 || day > 6) errors.push("dayOfWeek must be 0-6");
        if (!/^\d{2}:\d{2}$/.test(row.startTime)) errors.push("startTime must be HH:MM");
        if (!/^\d{2}:\d{2}$/.test(row.endTime))   errors.push("endTime must be HH:MM");
        if (!row.validFrom)          errors.push("validFrom required");

        return {
            ...row,
            dayOfWeek: isNaN(day) ? 0 : day,
            _status: errors.length ? "error" : "valid",
            _error: errors.join(", "),
        } as TimetableRow;
    });
}

export default function TimetableBulkPage() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [rows, setRows] = useState<TimetableRow[]>([]);
    const [fileName, setFileName] = useState("");
    const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
    const [importing, setImporting] = useState(false);

    const validRows  = rows.filter(r => r._status === "valid");
    const invalidRows = rows.filter(r => r._status === "error");

    function processFile(file: File) {
        if (!file.name.endsWith(".csv")) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = e => {
            const parsed = parseCSV(e.target?.result as string);
            setRows(parsed);
            setResult(null);
        };
        reader.readAsText(file);
    }

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, []);

    async function handleImport() {
        setImporting(true);
        try {
            const { data } = await axios.post(`${API}/timetable/bulk`, { schedules: validRows }, cfg);
            setResult(data);
        } catch (err: any) {
            setResult({ imported: 0, errors: [err.response?.data?.message ?? err.message] });
        } finally {
            setImporting(false);
        }
    }

    function downloadExample() {
        const blob = new Blob([EXAMPLE_CSV], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "timetable_template.csv"; a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-500 hover:scale-105 transition-transform shadow-sm">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <CalendarDays className="w-6 h-6 text-primary" /> Timetable Bulk Import
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Upload a CSV to set class schedules at scale</p>
                    </div>
                </div>
                <button onClick={downloadExample}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-bold hover:border-primary/40 transition-all shadow-sm">
                    <Download className="w-4 h-4" /> Download Template
                </button>
            </header>

            {/* CSV Format Guide */}
            <div className="glass rounded-[2rem] border border-white/20 dark:border-white/10 p-6 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <Info className="w-4 h-4 text-blue-500" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">CSV Format</h3>
                </div>
                <div className="overflow-x-auto rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-xs font-mono">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                {["className *", "dayOfWeek *", "startTime *", "endTime *", "room", "recurrence", "validFrom *", "validUntil"].map(h => (
                                    <th key={h} className="text-left px-4 py-2.5 text-slate-500 dark:text-slate-400 font-black">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                {["Math 10A", "1 (Mon)", "08:00", "09:00", "Room 12", "weekly", "2025-09-01", "2026-06-30"].map((v, i) => (
                                    <td key={i} className="px-4 py-2 text-slate-700 dark:text-slate-300">{v}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-slate-400">* required · dayOfWeek: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat · recurrence: weekly | biweekly | daily</p>
            </div>

            {/* Drop Zone */}
            <div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileRef.current?.click()}
                className={cn(
                    "relative glass rounded-[2.5rem] border-2 border-dashed p-14 text-center cursor-pointer transition-all",
                    isDragging
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-slate-300 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5"
                )}>
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
                <div className="flex flex-col items-center gap-4">
                    <div className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-colors", isDragging ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}>
                        <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                            {fileName ? fileName : "Drop your CSV file here"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {fileName ? `${rows.length} rows detected` : "or click to browse"}
                        </p>
                    </div>
                    {fileName && (
                        <button onClick={e => { e.stopPropagation(); setRows([]); setFileName(""); setResult(null); }}
                            className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-500 transition-colors font-bold">
                            <X className="w-4 h-4" /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Preview Table */}
            <AnimatePresence>
                {rows.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        {/* Summary */}
                        <div className="flex gap-3 flex-wrap">
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                                <CheckCircle2 className="w-4 h-4" /> {validRows.length} valid rows
                            </div>
                            {invalidRows.length > 0 && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-bold">
                                    <AlertCircle className="w-4 h-4" /> {invalidRows.length} rows with errors
                                </div>
                            )}
                        </div>

                        {/* Table */}
                        <div className="glass rounded-[2rem] border border-white/20 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            {["Status", "Class", "Day", "Time", "Room", "Recurrence", "Valid From", "Valid Until"].map(h => (
                                                <th key={h} className="text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {rows.map((r, i) => (
                                            <tr key={i} className={cn(r._status === "error" ? "bg-red-50/50 dark:bg-red-900/10" : "")}>
                                                <td className="px-5 py-3">
                                                    {r._status === "valid"
                                                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                        : <div title={r._error}><AlertCircle className="w-4 h-4 text-red-500 cursor-help" /></div>
                                                    }
                                                </td>
                                                <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">{r.className}</td>
                                                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{DAYS[r.dayOfWeek] ?? r.dayOfWeek}</td>
                                                <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                        {r.startTime} – {r.endTime}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-slate-500">{r.room || "—"}</td>
                                                <td className="px-5 py-3">
                                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                                        {r.recurrence || "weekly"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-slate-500 text-xs">{r.validFrom}</td>
                                                <td className="px-5 py-3 text-slate-500 text-xs">{r.validUntil || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Import button */}
                        {validRows.length > 0 && !result && (
                            <div className="flex justify-end">
                                <button onClick={handleImport} disabled={importing}
                                    className="flex items-center gap-2 px-8 py-3.5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.99] transition-all disabled:opacity-60 shadow-lg shadow-primary/20">
                                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    Import {validRows.length} Schedule{validRows.length !== 1 ? "s" : ""}
                                </button>
                            </div>
                        )}

                        {/* Result */}
                        {result && (
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                className={cn("p-5 rounded-2xl border font-bold text-sm flex items-center gap-3",
                                    result.errors.length > 0
                                        ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                                        : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                                )}>
                                {result.errors.length > 0 ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
                                <div>
                                    <p>{result.imported} schedule{result.imported !== 1 ? "s" : ""} imported successfully.</p>
                                    {result.errors.map((e, i) => <p key={i} className="text-xs mt-1 opacity-80">{e}</p>)}
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
