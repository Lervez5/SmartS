"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, Search, Loader2, Shield, User } from "lucide-react";
import { cn } from "@schoolos/utils";

interface AuditLog {
    id: string;
    userId: string | null;
    action: string;
    details: string;
    createdAt: string;
    user?: {
        name?: string;
        email: string;
    };
}

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchLogs();
    }, []);

    async function fetchLogs() {
        try {
            const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
            const res = await fetch(`${API}/audit-logs`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }

    const filteredLogs = logs.filter(log => 
        log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user?.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-20">
            <header>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <History className="w-8 h-8 text-primary" />
                    Audit Logs
                </h1>
                <p className="text-muted-foreground mt-1">Track all system actions and user activities.</p>
            </header>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search logs..."
                    className="w-full pl-12 pr-4 py-3 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm outline-none focus:border-primary transition-all shadow-sm"
                />
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : logs.length > 0 ? (
                <div className="glass rounded-[2.5rem] border border-white/20 overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <div className="grid grid-cols-12 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <div className="col-span-3">User</div>
                            <div className="col-span-2">Action</div>
                            <div className="col-span-5">Details</div>
                            <div className="col-span-2 text-right">Date</div>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredLogs.map((log) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-white/30 dark:hover:bg-slate-800/30 transition-colors"
                            >
                                <div className="col-span-3 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        {log.user?.name ? <User className="w-4 h-4 text-primary" /> : <Shield className="w-4 h-4 text-primary" />}
                                    </div>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                        {log.user?.name || log.user?.email || "System"}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-xs font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-lg">
                                        {log.action}
                                    </span>
                                </div>
                                <div className="col-span-5 text-sm text-slate-600 dark:text-slate-400 truncate">
                                    {log.details}
                                </div>
                                <div className="col-span-2 text-right text-xs text-slate-500">
                                    {new Date(log.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="glass rounded-[2.5rem] p-16 text-center border border-white/20">
                    <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-400 mb-2">No audit logs found</h3>
                    <p className="text-muted-foreground">No audit logs available for the selected criteria.</p>
                </div>
            )}
        </div>
    );
}
