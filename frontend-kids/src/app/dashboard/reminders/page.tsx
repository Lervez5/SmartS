"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
    Bell, Plus, X, Check, Clock, AlertCircle, Loader2,
    ChevronDown, Trash2, CalendarDays, BellOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API = "http://localhost:4000/api";
const cfg = { withCredentials: true };

type Priority = "low" | "medium" | "high";
type Repeat   = "none" | "daily" | "weekly" | "monthly";

interface Reminder {
    id: string;
    title: string;
    description?: string;
    dueDate: string;
    priority: Priority;
    repeat: Repeat;
    channel: string;
    isDone: boolean;
    snoozedUntil?: string;
}

const PRIORITY_STYLES: Record<Priority, { label: string; dot: string; badge: string }> = {
    high:   { label: "High",   dot: "bg-red-500",    badge: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" },
    medium: { label: "Medium", dot: "bg-amber-500",  badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
    low:    { label: "Low",    dot: "bg-slate-400",  badge: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" },
};

function formatDue(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffH = Math.round(diffMs / 3_600_000);
    if (diffH < 0)   return { label: "Overdue", urgent: true };
    if (diffH < 1)   return { label: "Due soon", urgent: true };
    if (diffH < 24)  return { label: `In ${diffH}h`, urgent: false };
    const diffD = Math.round(diffH / 24);
    return { label: `In ${diffD}d`, urgent: false };
}

function CreateReminderModal({ onClose }: { onClose: () => void }) {
    const qc = useQueryClient();
    const create = useMutation({
        mutationFn: (data: any) => axios.post(`${API}/reminders`, data, cfg).then(r => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["reminders"] }); onClose(); },
    });

    const getDefaultDueDate = () => {
        const d = new Date();
        d.setHours(d.getHours() + 1, 0, 0, 0);
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };

    const getLocalISO = () => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 16);
    };

    const [form, setForm] = useState({
        title: "", description: "", dueDate: getDefaultDueDate(), priority: "medium" as Priority,
        repeat: "none" as Repeat, channel: "in_app",
    });

    const [nowISO, setNowISO] = useState(getLocalISO());
    useEffect(() => {
        setNowISO(getLocalISO());
        const interval = setInterval(() => setNowISO(getLocalISO()), 60000);
        return () => clearInterval(interval);
    }, []);

    const inputCls = "w-full bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-white placeholder:text-slate-400 border border-slate-200 dark:border-slate-700 focus:border-primary/60 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all";
    const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1";

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-primary to-cyan-500 rounded-t-[2.5rem]" />
                <div className="p-8 space-y-5">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Bell className="w-5 h-5 text-primary" /> New Reminder
                        </h2>
                        <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <form onSubmit={e => { 
                        e.preventDefault(); 
                        if (new Date(form.dueDate) < new Date()) {
                            alert("Due date cannot be in the past.");
                            return;
                        }
                        create.mutate({ ...form, dueDate: new Date(form.dueDate).toISOString() }); 
                    }} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className={labelCls}>Title</label>
                            <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="What do you need to do?" className={inputCls} />
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Due Date & Time</label>
                            <input required type="datetime-local" min={nowISO} value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} className={inputCls} />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {(["low", "medium", "high"] as Priority[]).map(p => (
                                <button type="button" key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                                    className={cn("py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all", form.priority === p ? `${PRIORITY_STYLES[p].badge} border-transparent` : "border-slate-200 dark:border-slate-700 text-slate-400")}>
                                    {PRIORITY_STYLES[p].label}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className={labelCls}>Repeat</label>
                                <select value={form.repeat} onChange={e => setForm(p => ({ ...p, repeat: e.target.value as Repeat }))} className={inputCls}>
                                    <option value="none">No repeat</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelCls}>Notify via</label>
                                <select value={form.channel} onChange={e => setForm(p => ({ ...p, channel: e.target.value }))} className={inputCls}>
                                    <option value="in_app">In-App</option>
                                    <option value="email">Email</option>
                                    <option value="both">Both</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className={labelCls}>Note (optional)</label>
                            <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Add any extra notes or context..." className={cn(inputCls, "resize-none")} />
                        </div>
                        <button type="submit" disabled={create.isPending}
                            className="w-full py-3.5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.01] transition-all disabled:opacity-60 shadow-lg shadow-primary/20">
                            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                            Set Reminder
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}

export default function RemindersPage() {
    const qc = useQueryClient();
    const [showCreate, setShowCreate] = useState(false);
    const [showDone, setShowDone]     = useState(false);

    const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
        queryKey: ["reminders", showDone],
        queryFn: () => axios.get(`${API}/reminders`, { ...cfg, params: { all: showDone } }).then(r => r.data),
    });

    const markDone = useMutation({
        mutationFn: (id: string) => axios.patch(`${API}/reminders/${id}/done`, {}, cfg),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
    });
    const snooze = useMutation({
        mutationFn: (id: string) => axios.patch(`${API}/reminders/${id}/snooze`, { minutes: 30 }, cfg),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
    });
    const remove = useMutation({
        mutationFn: (id: string) => axios.delete(`${API}/reminders/${id}`, cfg),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
    });

    const active   = reminders.filter(r => !r.isDone);
    const overdue  = active.filter(r => new Date(r.dueDate) < new Date());
    const upcoming = active.filter(r => new Date(r.dueDate) >= new Date());
    const done     = reminders.filter(r => r.isDone);

    return (
        <div className="space-y-10 pb-20">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <Bell className="w-8 h-8 text-primary" /> Reminders
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {active.length} active · {overdue.length > 0 && <span className="text-red-500 font-bold">{overdue.length} overdue</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowDone(p => !p)}
                        className={cn("flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-bold transition-all",
                            showDone ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                                     : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200")}>
                        <Check className="w-4 h-4" /> {showDone ? "Hide Done" : "Show Done"}
                    </button>
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-2xl font-bold text-sm hover:scale-[1.02] transition-all shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4" /> New Reminder
                    </button>
                </div>
            </header>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
                <div className="space-y-6">
                    {/* Overdue */}
                    {overdue.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                                <AlertCircle className="w-4 h-4 text-red-500" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-red-500">Overdue</h2>
                            </div>
                            {overdue.map((r, i) => <ReminderCard key={r.id} reminder={r} i={i} onDone={() => markDone.mutate(r.id)} onSnooze={() => snooze.mutate(r.id)} onDelete={() => remove.mutate(r.id)} />)}
                        </div>
                    )}

                    {/* Upcoming */}
                    {upcoming.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                                <Bell className="w-4 h-4 text-primary" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Upcoming</h2>
                            </div>
                            {upcoming.map((r, i) => <ReminderCard key={r.id} reminder={r} i={i} onDone={() => markDone.mutate(r.id)} onSnooze={() => snooze.mutate(r.id)} onDelete={() => remove.mutate(r.id)} />)}
                        </div>
                    )}

                    {/* Done */}
                    {showDone && done.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 px-2">
                                <Check className="w-4 h-4 text-slate-400" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Completed</h2>
                            </div>
                            {done.map((r, i) => <ReminderCard key={r.id} reminder={r} i={i} done onDelete={() => remove.mutate(r.id)} />)}
                        </div>
                    )}

                    {active.length === 0 && !isLoading && (
                        <div className="glass rounded-[2.5rem] p-16 text-center border border-white/20">
                            <BellOff className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold">No active reminders.</p>
                            <p className="text-slate-400 text-sm mt-1">Create one to stay on top of your schedule.</p>
                        </div>
                    )}
                </div>
            )}

            <AnimatePresence>
                {showCreate && <CreateReminderModal onClose={() => setShowCreate(false)} />}
            </AnimatePresence>
        </div>
    );
}

function ReminderCard({ reminder: r, i, done, onDone, onSnooze, onDelete }: {
    reminder: Reminder; i: number; done?: boolean;
    onDone?: () => void; onSnooze?: () => void; onDelete?: () => void;
}) {
    const p = PRIORITY_STYLES[r.priority];
    const due = formatDue(r.dueDate);

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className={cn("glass rounded-[2rem] p-5 border border-white/20 dark:border-white/10 flex items-center gap-5 transition-all", done && "opacity-50")}>
            {/* Priority dot */}
            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", p.dot)} />

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn("font-bold text-slate-900 dark:text-white", done && "line-through")}>{r.title}</p>
                    <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg", p.badge)}>{p.label}</span>
                    {r.repeat !== "none" && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">↺ {r.repeat}</span>
                    )}
                </div>
                {r.description && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{r.description}</p>}
                <div className="flex items-center gap-3 mt-1.5">
                    <span className={cn("text-[10px] font-bold flex items-center gap-1", due.urgent ? "text-red-500" : "text-slate-400")}>
                        <Clock className="w-3 h-3" />
                        {new Date(r.dueDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        <span className="ml-1">({due.label})</span>
                    </span>
                </div>
            </div>

            {/* Actions */}
            {!done && (
                <div className="flex items-center gap-2 shrink-0">
                    <button onClick={onSnooze} title="Snooze 30 min"
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-500 transition-colors">
                        <Clock className="w-4 h-4" />
                    </button>
                    <button onClick={onDone}
                        className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:scale-105 transition-transform">
                        <Check className="w-4 h-4" />
                    </button>
                </div>
            )}
            <button onClick={onDelete}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                <Trash2 className="w-4 h-4" />
            </button>
        </motion.div>
    );
}
