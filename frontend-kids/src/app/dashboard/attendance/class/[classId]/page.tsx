"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
    ArrowLeft, Search, CheckCircle2, Users, Loader2,
    Save, Send, UserCheck, ChevronDown, StickyNote, X,
} from "lucide-react";
import { useClassRoster, useMarkAttendance } from "@/hooks/use-attendance";
import { useAttendanceStore, AttendanceStatus } from "@/store/attendance.store";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string; bg: string; darkBg: string }[] = [
    { value: "present",  label: "Present",  color: "text-emerald-600", bg: "bg-emerald-100", darkBg: "dark:bg-emerald-900/40" },
    { value: "absent",   label: "Absent",   color: "text-red-600",     bg: "bg-red-100",     darkBg: "dark:bg-red-900/40" },
    { value: "late",     label: "Late",     color: "text-amber-600",   bg: "bg-amber-100",   darkBg: "dark:bg-amber-900/40" },
    { value: "excused",  label: "Excused",  color: "text-blue-600",    bg: "bg-blue-100",    darkBg: "dark:bg-blue-900/40" },
    { value: "sick",     label: "Sick",     color: "text-purple-600",  bg: "bg-purple-100",  darkBg: "dark:bg-purple-900/40" },
    { value: "on_leave", label: "On Leave", color: "text-slate-500",   bg: "bg-slate-100",   darkBg: "dark:bg-slate-800" },
];

function getStatusStyle(status: AttendanceStatus | undefined) {
    return STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_OPTIONS[0];
}

export default function ClassAttendancePage() {
    const params = useParams<{ classId: string }>();
    const classId = params.classId;
    const router = useRouter();

    const { selectedDate, setDate, draft, markStudent, bulkMark, setNote, loadExisting, filters, setFilter } = useAttendanceStore();
    const [noteOpen, setNoteOpen] = useState<string | null>(null);
    const [tempNote, setTempNote] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const { data: roster, isLoading } = useClassRoster(classId, selectedDate);
    const { mutateAsync: markAttendance, isPending } = useMarkAttendance();

    // Load existing attendance from server into draft
    useEffect(() => {
        if (!roster) return;
        const existing = roster
            .filter(r => r.attendance !== null)
            .map(r => ({
                studentId: r.student.id,
                status: r.attendance!.status as AttendanceStatus,
                note: r.attendance!.note ?? undefined,
            }));
        if (existing.length > 0) loadExisting(existing);
    }, [roster]);

    const students = roster?.map(r => r.student) ?? [];

    // Filter students
    const filteredStudents = students.filter(s => {
        const name = `${s.name ?? ""} ${s.firstName ?? ""} ${s.lastName ?? ""} ${s.email}`.toLowerCase();
        const matchesSearch = name.includes(filters.search.toLowerCase());
        const matchesStatus = filters.status === "all" || (draft[s.id]?.status ?? "present") === filters.status;
        return matchesSearch && matchesStatus;
    });

    const allStudentIds = students.map(s => s.id);
    const markedCount = allStudentIds.filter(id => draft[id]).length;

    async function handleSubmit(isDraft: boolean) {
        const records = allStudentIds.map(id => ({
            studentId: id,
            status: draft[id]?.status ?? "present",
            note: draft[id]?.note,
        }));

        await markAttendance({ classId, date: selectedDate, records, isDraft });
        setSuccessMsg(isDraft ? "Draft saved!" : "Attendance submitted!");
        setTimeout(() => setSuccessMsg(""), 3000);
        if (!isDraft) router.push("/dashboard/attendance");
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/attendance"
                        className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-slate-500 hover:scale-105 transition-transform"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mark Attendance</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{markedCount} of {students.length} marked</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setDate(e.target.value)}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl px-4 py-2.5 text-sm font-medium outline-none focus:border-primary/60"
                    />
                    <button
                        onClick={() => bulkMark(allStudentIds, "present")}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                    >
                        <UserCheck className="w-4 h-4 text-emerald-500" />
                        All Present
                    </button>
                </div>
            </header>

            {/* Success banner */}
            <AnimatePresence>
                {successMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl font-bold text-sm flex items-center gap-2"
                    >
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        {successMsg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search + Filter bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search students..."
                        value={filters.search}
                        onChange={e => setFilter({ search: e.target.value })}
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:border-primary/60"
                    />
                </div>
                <select
                    value={filters.status}
                    onChange={e => setFilter({ status: e.target.value as any })}
                    className="bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-primary/60 cursor-pointer"
                >
                    <option value="all">All Statuses</option>
                    {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
            </div>

            {/* Roster */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredStudents.map((student, i) => {
                        const currentStatus = draft[student.id]?.status;
                        const style = getStatusStyle(currentStatus);
                        const initials = (student.name ?? student.email).charAt(0).toUpperCase();
                        const displayName = (student.name ?? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim()) || student.email;

                        return (
                            <motion.div
                                key={student.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="glass rounded-[1.75rem] p-5 border border-white/20 dark:border-white/10"
                            >
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    {/* Student Info */}
                                    <div className="flex items-center gap-4">
                                        {student.avatar ? (
                                            <img src={student.avatar} alt={displayName} className="w-12 h-12 rounded-2xl object-cover shadow" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-black text-lg text-primary shadow-inner">
                                                {initials}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white">{displayName}</p>
                                            <p className="text-xs text-slate-500 font-medium">{student.email}</p>
                                        </div>
                                    </div>

                                    {/* Status Pills */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {STATUS_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => markStudent(student.id, opt.value)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                                    currentStatus === opt.value
                                                        ? `${opt.bg} ${opt.darkBg} ${opt.color} border-transparent scale-105 shadow-sm`
                                                        : "bg-white/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}

                                        {/* Note toggle */}
                                        <button
                                            onClick={() => { setNoteOpen(student.id); setTempNote(draft[student.id]?.note ?? ""); }}
                                            className={cn(
                                                "p-1.5 rounded-xl border transition-all",
                                                draft[student.id]?.note
                                                    ? "bg-primary/10 border-primary/30 text-primary"
                                                    : "bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-primary"
                                            )}
                                        >
                                            <StickyNote className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Note inline display */}
                                {draft[student.id]?.note && noteOpen !== student.id && (
                                    <p className="mt-3 ml-16 text-xs text-slate-500 italic border-l-2 border-primary/30 pl-3">
                                        {draft[student.id].note}
                                    </p>
                                )}

                                {/* Note editor */}
                                <AnimatePresence>
                                    {noteOpen === student.id && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-4 ml-16 space-y-2 overflow-hidden"
                                        >
                                            <textarea
                                                autoFocus
                                                value={tempNote}
                                                onChange={e => setTempNote(e.target.value)}
                                                placeholder="Add a note (optional)..."
                                                rows={2}
                                                className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl p-3 text-xs font-medium outline-none focus:border-primary/60 resize-none"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setNote(student.id, tempNote); setNoteOpen(null); }}
                                                    className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:scale-105 transition-transform"
                                                >Save Note</button>
                                                <button
                                                    onClick={() => setNoteOpen(null)}
                                                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-xs font-bold"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}

                    {filteredStudents.length === 0 && !isLoading && (
                        <div className="glass rounded-[2.5rem] p-16 text-center border border-white/20">
                            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">No students match your filter.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Action Footer */}
            {students.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-[2rem] px-6 py-4 z-50"
                >
                    <button
                        onClick={() => handleSubmit(true)}
                        disabled={isPending}
                        className="flex items-center gap-2 px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Draft
                    </button>
                    <button
                        onClick={() => handleSubmit(false)}
                        disabled={isPending}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Submit Final
                    </button>
                </motion.div>
            )}
        </div>
    );
}
