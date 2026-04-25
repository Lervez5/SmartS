"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, DateSelectArg, EventDropArg } from "@fullcalendar/core";
import {
    CalendarDays, Plus, X, ChevronLeft, ChevronRight,
    Clock, MapPin, AlignLeft, BookOpen, Loader2, CheckCircle2,
    LayoutGrid, List, Calendar, Trash2,
} from "lucide-react";
import { useCalendarEvents, useCreateCalendarEvent, useDeleteCalendarEvent } from "@/hooks/use-calendar";
import { useCalendarStore, CalendarView, CalendarEventType } from "@/store/calendar.store";
import { cn } from "@/lib/utils";

// ─── Event Type Config ──────────────────────────────────────────────────────────
const EVENT_TYPES: { value: CalendarEventType; label: string; color: string; emoji: string }[] = [
    { value: "class_session",     label: "Class",       color: "#22c55e", emoji: "📚" },
    { value: "assignment_due",    label: "Assignment",  color: "#f59e0b", emoji: "📋" },
    { value: "quiz",              label: "Quiz",        color: "#8b5cf6", emoji: "✏️" },
    { value: "examination",       label: "Exam",        color: "#ef4444", emoji: "📝" },
    { value: "school_event",      label: "School",      color: "#3b82f6", emoji: "🏫" },
    { value: "holiday",           label: "Holiday",     color: "#64748b", emoji: "🎉" },
    { value: "personal_reminder", label: "Reminder",    color: "#06b6d4", emoji: "🔔" },
    { value: "meeting",           label: "Meeting",     color: "#ec4899", emoji: "👥" },
];

const VIEW_OPTIONS: { key: CalendarView; label: string; icon: React.FC<any> }[] = [
    { key: "dayGridMonth",  label: "Month", icon: LayoutGrid },
    { key: "timeGridWeek",  label: "Week",  icon: Calendar },
    { key: "timeGridDay",   label: "Day",   icon: CalendarDays },
    { key: "listWeek",      label: "List",  icon: List },
];

// ─── Create Event Modal ─────────────────────────────────────────────────────────
function CreateEventModal({
    isOpen, onClose, initialDate,
}: { isOpen: boolean; onClose: () => void; initialDate?: string }) {
    const { mutateAsync: createEvent, isPending } = useCreateCalendarEvent();
    const [form, setForm] = useState({
        title: "", type: "personal_reminder" as CalendarEventType,
        startDate: initialDate ?? new Date().toISOString().slice(0, 16),
        endDate: "", allDay: false, description: "", visibility: "personal" as const,
    });
    const [success, setSuccess] = useState(false);
    const [dateError, setDateError] = useState("");

    // Minimum datetime = now (no past events)
    const nowISO = new Date().toISOString().slice(0, 16);

    const typeConfig = EVENT_TYPES.find(t => t.value === form.type)!;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setDateError("");
        if (new Date(form.startDate) < new Date()) {
            setDateError("Start date cannot be in the past.");
            return;
        }
        await createEvent({
            title: form.title, type: form.type,
            startDate: new Date(form.startDate).toISOString(),
            endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
            allDay: form.allDay, description: form.description, visibility: form.visibility,
        });
        setSuccess(true);
        setTimeout(() => { setSuccess(false); onClose(); }, 1200);
    }

    const inputCls = "w-full bg-white/70 dark:bg-slate-800/70 text-slate-900 dark:text-white placeholder:text-slate-400 border border-slate-200 dark:border-slate-700 focus:border-primary/60 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all";
    const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1";

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Colour band header */}
                <div className="h-2 w-full rounded-t-[2.5rem]" style={{ background: typeConfig.color }} />
                <div className="p-8 space-y-5">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{typeConfig.emoji}</span> New Event
                        </h2>
                        <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Title */}
                        <div className="space-y-1.5">
                            <label className={labelCls}>Title</label>
                            <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                placeholder="Event title..." className={inputCls} />
                        </div>

                        {/* Type pills */}
                        <div className="space-y-1.5">
                            <label className={labelCls}>Type</label>
                            <div className="flex flex-wrap gap-2">
                                {EVENT_TYPES.map(t => (
                                    <button key={t.value} type="button"
                                        onClick={() => setForm(p => ({ ...p, type: t.value }))}
                                        className={cn(
                                            "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all",
                                            form.type === t.value
                                                ? "text-white border-transparent scale-105 shadow-sm"
                                                : "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                                        )}
                                        style={form.type === t.value ? { background: t.color } : {}}
                                    >
                                        {t.emoji} {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className={labelCls}>Start</label>
                                <input type={form.allDay ? "date" : "datetime-local"} required
                                    min={nowISO}
                                    value={form.startDate} onChange={e => { setForm(p => ({ ...p, startDate: e.target.value })); setDateError(""); }}
                                    className={cn(inputCls, dateError ? "border-red-400 dark:border-red-500" : "")} />
                                {dateError && <p className="text-[10px] text-red-500 font-bold ml-1">{dateError}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelCls}>End (optional)</label>
                                <input type={form.allDay ? "date" : "datetime-local"}
                                    min={form.startDate || nowISO}
                                    value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                                    className={inputCls} />
                            </div>
                        </div>

                        {/* All day toggle */}
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div onClick={() => setForm(p => ({ ...p, allDay: !p.allDay }))}
                                className={cn("w-10 h-6 rounded-full transition-all relative", form.allDay ? "bg-primary" : "bg-slate-200 dark:bg-slate-700")}>
                                <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all", form.allDay ? "left-5" : "left-1")} />
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">All-day event</span>
                        </label>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <label className={labelCls}>Description (optional)</label>
                            <textarea rows={2} value={form.description}
                                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                placeholder="Add details..." className={cn(inputCls, "resize-none")} />
                        </div>

                        {/* Visibility */}
                        <div className="space-y-1.5">
                            <label className={labelCls}>Visibility</label>
                            <select value={form.visibility} onChange={e => setForm(p => ({ ...p, visibility: e.target.value as any }))}
                                className={inputCls}>
                                <option value="personal">Personal only</option>
                                <option value="class">My classes</option>
                                <option value="school">School-wide</option>
                            </select>
                        </div>

                        {success ? (
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                                <CheckCircle2 className="w-5 h-5 shrink-0" /> Event created!
                            </div>
                        ) : (
                            <button type="submit" disabled={isPending}
                                className="w-full py-3.5 rounded-2xl text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 shadow-lg"
                                style={{ background: typeConfig.color }}>
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Create Event
                            </button>
                        )}
                    </form>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Event Detail Slide-out ─────────────────────────────────────────────────────
function EventDetailPanel({ event, onClose }: { event: any; onClose: () => void }) {
    const { mutateAsync: deleteEvent, isPending } = useDeleteCalendarEvent();
    const typeConfig = EVENT_TYPES.find(t => t.value === event.extendedProps?.type) ?? EVENT_TYPES[0];

    async function handleDelete() {
        await deleteEvent(event.id);
        onClose();
    }

    return (
        <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="h-1.5 w-full" style={{ background: typeConfig.color }} />
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{typeConfig.emoji}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg text-white"
                            style={{ background: typeConfig.color }}>
                            {typeConfig.label}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">{event.title}</h3>

                <div className="space-y-3">
                    <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                        <Clock className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                                {new Date(event.start).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                            </p>
                            {!event.allDay && (
                                <p className="text-xs mt-0.5">
                                    {new Date(event.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    {event.end ? ` — ${new Date(event.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                                </p>
                            )}
                        </div>
                    </div>

                    {event.extendedProps?.description && (
                        <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                            <AlignLeft className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                            <p className="leading-relaxed">{event.extendedProps.description}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                <button onClick={handleDelete} disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-all disabled:opacity-50">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete Event
                </button>
            </div>
        </motion.div>
    );
}

// ─── Main Calendar Page ─────────────────────────────────────────────────────────
export default function CalendarPage() {
    const calendarRef = useRef<FullCalendar>(null);
    const { activeView, setView, selectedEvent, selectEvent, typeFilters, toggleTypeFilter, clearFilters } = useCalendarStore();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createDate, setCreateDate] = useState<string | undefined>();
    const [currentTitle, setCurrentTitle] = useState("");

    const { data: events = [], isLoading } = useCalendarEvents();

    // Map to FullCalendar format, applying type filters
    const fcEvents = events
        .filter(e => typeFilters.length === 0 || typeFilters.includes(e.type as CalendarEventType))
        .map(e => ({
            id: e.id,
            title: e.title,
            start: e.startDate,
            end: e.endDate ?? undefined,
            allDay: e.allDay,
            backgroundColor: e.color,
            borderColor: e.color,
            extendedProps: {
                type: e.type,
                description: e.description,
                visibility: e.visibility,
            },
        }));

    const navigate = useCallback((dir: "prev" | "next" | "today") => {
        const api = calendarRef.current?.getApi();
        if (!api) return;
        dir === "prev" ? api.prev() : dir === "next" ? api.next() : api.today();
        setCurrentTitle(api.view.title);
    }, []);

    const handleEventClick = useCallback((info: EventClickArg) => {
        selectEvent(info.event as any);
    }, []);

    const handleDateSelect = useCallback((info: DateSelectArg) => {
        // Disallow creating events on past dates
        if (new Date(info.startStr) < new Date()) return;
        setCreateDate(info.startStr);
        setIsCreateOpen(true);
    }, []);

    return (
        <div className="flex h-[calc(100vh-7rem)] gap-6 max-w-full overflow-hidden">

            {/* ── Left Sidebar ── */}
            <aside className="w-60 shrink-0 flex flex-col gap-4 overflow-y-auto pb-4">
                <button onClick={() => setIsCreateOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4" /> New Event
                </button>

                {/* View switcher */}
                <div className="glass rounded-2xl border border-white/20 overflow-hidden">
                    {VIEW_OPTIONS.map(v => (
                        <button key={v.key}
                            onClick={() => { setView(v.key); calendarRef.current?.getApi().changeView(v.key); }}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-all",
                                activeView === v.key
                                    ? "bg-primary text-white"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50"
                            )}>
                            <v.icon className="w-4 h-4" /> {v.label}
                        </button>
                    ))}
                </div>

                {/* Event type legend + filters */}
                <div className="glass rounded-2xl border border-white/20 p-4 space-y-1">
                    <div className="flex justify-between items-center mb-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Filter by Type</p>
                        {typeFilters.length > 0 && (
                            <button onClick={clearFilters} className="text-[10px] font-bold text-primary hover:underline">Clear</button>
                        )}
                    </div>
                    {EVENT_TYPES.map(t => (
                        <button key={t.value} onClick={() => toggleTypeFilter(t.value)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold transition-all",
                                typeFilters.includes(t.value)
                                    ? "bg-slate-100 dark:bg-slate-800"
                                    : "hover:bg-white/50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400"
                            )}>
                            <div className="w-3 h-3 rounded-full shrink-0 transition-all"
                                style={{ background: typeFilters.includes(t.value) ? t.color : "#cbd5e1" }} />
                            <span className={typeFilters.includes(t.value) ? "text-slate-900 dark:text-white" : ""}>{t.label}</span>
                        </button>
                    ))}
                </div>
            </aside>

            {/* ── Main Calendar Area ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Custom Navigation Bar */}
                <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate("prev")}
                            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:border-primary/40 transition-all shadow-sm">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={() => navigate("today")}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-primary/40 transition-all shadow-sm">
                            Today
                        </button>
                        <button onClick={() => navigate("next")}
                            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:border-primary/40 transition-all shadow-sm">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {calendarRef.current?.getApi()?.view?.title ?? new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </h2>
                    <div className="w-32" /> {/* spacer */}
                </div>

                {/* FullCalendar */}
                <div className="flex-1 glass rounded-[2rem] border border-white/20 overflow-hidden p-4 calendar-container">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    )}
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                        initialView={activeView}
                        headerToolbar={false}
                        events={fcEvents}
                        selectable
                        selectMirror
                        dayMaxEvents={3}
                        weekends
                        height="100%"
                        eventClick={handleEventClick}
                        select={handleDateSelect}
                        eventClassNames="rounded-lg text-xs font-bold cursor-pointer border-0 px-1.5"
                        datesSet={(info) => setCurrentTitle(info.view.title)}
                    />
                </div>
            </div>

            {/* ── Event Detail Panel ── */}
            <AnimatePresence>
                {selectedEvent && (
                    <EventDetailPanel event={selectedEvent} onClose={() => selectEvent(null)} />
                )}
            </AnimatePresence>

            {/* ── Create Event Modal ── */}
            <AnimatePresence>
                {isCreateOpen && (
                    <CreateEventModal isOpen={isCreateOpen} initialDate={createDate}
                        onClose={() => { setIsCreateOpen(false); setCreateDate(undefined); }} />
                )}
            </AnimatePresence>
        </div>
    );
}
