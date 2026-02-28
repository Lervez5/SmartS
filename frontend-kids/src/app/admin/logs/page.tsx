"use client";

import React, { useEffect, useState } from "react";
import { History, Search, Download, ShieldAlert, Loader2 } from "lucide-react";

interface AuditLog {
    id: string;
    userId: string | null;
    action: string;
    details: string;
    createdAt: string;
    user?: {
        name: string | null;
        email: string;
    };
}

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        let mounted = true;

        const fetchLogs = async () => {
            try {
                const res = await fetch("http://localhost:4000/api/audit-logs", { credentials: "include" });
                if (!res.ok) throw new Error("Failed to fetch secure audit logs.");

                const data = await res.json();
                if (mounted) {
                    setLogs(data.logs);
                    setIsLoading(false);
                }
            } catch (err: any) {
                if (mounted) {
                    setError(err.message);
                    setIsLoading(false);
                }
            }
        };

        fetchLogs();

        return () => { mounted = false; };
    }, []);

    const filteredLogs = logs.filter(log => {
        const query = searchQuery.toLowerCase();
        return (
            log.action.toLowerCase().includes(query) ||
            log.details.toLowerCase().includes(query) ||
            (log.user?.email || "").toLowerCase().includes(query)
        );
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                <p className="text-slate-500 font-bold animate-pulse">Decrypting Security Logs...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto p-6 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-2xl font-bold flex items-center gap-3">
                <ShieldAlert className="w-6 h-6" />
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                        <History className="w-8 h-8 text-orange-500" />
                        Audit Logs
                    </h1>
                    <p className="text-muted-foreground mt-1">Monitor system activities and security events.</p>
                </div>
                <button className="glass px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </header>

            <div className="glass rounded-[2rem] overflow-hidden border border-slate-200/50 dark:border-slate-800 shadow-sm">
                <div className="p-6 border-b border-slate-200/50 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between bg-white/40 dark:bg-slate-900/40 gap-4">
                    <div className="relative group border border-slate-200/80 dark:border-slate-700 focus-within:border-orange-400 bg-white/60 dark:bg-slate-900/60 rounded-xl transition-colors overflow-hidden flex items-center">
                        <Search className="absolute left-3 w-4 h-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search events, actions, users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent py-2 pl-10 pr-4 text-sm outline-none transition-all w-full sm:w-80 placeholder:text-slate-400"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left bg-white/30 dark:bg-slate-900/30">
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-900/80 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200/50 dark:border-slate-800">
                                <th className="p-6 w-48">Timestamp</th>
                                <th className="p-6 w-64">User / Actor</th>
                                <th className="p-6 w-56">Action</th>
                                <th className="p-6">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLogs.map((log) => (
                                <tr key={log.id} className="text-sm text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors group">
                                    <td className="p-6 font-mono text-[11px] text-slate-500 font-bold">
                                        {new Date(log.createdAt).toLocaleString(undefined, {
                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                        })}
                                    </td>
                                    <td className="p-6 font-bold text-slate-900 dark:text-white">
                                        {log.user?.email || "System Actor"}
                                    </td>
                                    <td className="p-6">
                                        <span className="px-2.5 py-1 rounded-md bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-800 text-[11px] font-black uppercase tracking-wider">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <p className="text-xs font-medium text-slate-500 truncate max-w-md">
                                            {log.details}
                                        </p>
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center">
                                        <div className="inline-flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <History className="w-10 h-10 opacity-20" />
                                            <span className="font-bold text-sm">No tracking events found matching your filter.</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
