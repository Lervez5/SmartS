"use client";

import React from "react";
import {
    CreditCard,
    Baby,
    Settings,
    TrendingUp,
    Calendar,
    AlertCircle,
    Clock,
    ExternalLink,
    History as HistoryIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

const CHILDREN = [
    { id: "C1", name: "Timmy", avatar: "👦", level: 12, lastActive: "10m ago" },
    { id: "C2", name: "Sarah", avatar: "👧", level: 8, lastActive: "Yesterday" },
];

const PAYMENTS = [
    { id: "P1", date: "Nov 01, 2023", amount: "$19.99", status: "Successful", ref: "TXN-842" },
    { id: "P2", date: "Oct 01, 2023", amount: "$19.99", status: "Successful", ref: "TXN-210" },
];

export function ParentView() {
    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Parental Control & Billing</h1>
                <p className="text-muted-foreground text-lg italic">"Nurturing your sprout's potential, one lesson at a time."</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Children Overview */}
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Baby className="w-6 h-6 text-primary" />
                            Your Children
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {CHILDREN.map((child) => (
                                <div key={child.id} className="glass group overflow-hidden rounded-[2rem]">
                                    <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-3xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-4xl transform group-hover:rotate-12 transition-transform duration-300">
                                                {child.avatar}
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-bold">{child.name}</h4>
                                                <span className="text-xs bg-primary text-white font-bold px-2 py-0.5 rounded-full">Level {child.level}</span>
                                            </div>
                                        </div>
                                        <button className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-border dark:border-slate-700 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                                            <Settings className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="p-6 bg-white/50 dark:bg-slate-900/50 space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Learning Time</p>
                                                <p className="text-sm font-bold">12.4 Hours</p>
                                            </div>
                                            <div className="space-y-1 text-right">
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Activity</p>
                                                <p className="text-sm font-bold text-primary">{child.lastActive}</p>
                                            </div>
                                        </div>
                                        <button className="w-full bg-slate-900 dark:bg-slate-800 text-white rounded-2xl py-3 font-bold flex items-center justify-center gap-2 group/btn">
                                            View Progress Report
                                            <TrendingUp className="w-4 h-4 group-hover/btn:translate-y-1 group-hover/btn:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Payment History */}
                    <section className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <HistoryIcon className="w-6 h-6 text-primary" />
                            Recent Invoices
                        </h3>
                        <div className="glass rounded-[2rem] overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/80 dark:bg-slate-900/80">
                                    <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border dark:border-slate-800">
                                        <th className="px-6 py-4">Transaction ID</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Amount</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {PAYMENTS.map((payment) => (
                                        <tr key={payment.id} className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs">{payment.ref}</td>
                                            <td className="px-6 py-4">{payment.date}</td>
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{payment.amount}</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 text-green-600">
                                                    <div className="w-1 h-1 rounded-full bg-green-600" />
                                                    {payment.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* Subscription Card */}
                <aside className="space-y-6">
                    <div className="glass bg-slate-900 text-white p-8 rounded-[2.5rem] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 text-white/5 transform group-hover:scale-110 transition-transform">
                            <CreditCard className="w-32 h-32" />
                        </div>
                        <div className="relative z-10 space-y-8">
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/60">Active Plan</span>
                                <h4 className="text-4xl font-bold">Premium Annual</h4>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    <span>Renews on Oct 30, 2024</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>Card ending in **42</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
                                <button className="w-full bg-primary text-white py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-brand-light transition-colors">
                                    Manage Subscription
                                </button>
                                <button className="w-full bg-white/10 text-white py-3 rounded-2xl font-bold hover:bg-white/20 transition-colors">
                                    Payment Methods
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="glass p-6 rounded-[2rem] space-y-4">
                        <h4 className="font-bold flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-500" />
                            Help & Support
                        </h4>
                        <div className="space-y-3">
                            <button className="w-full flex justify-between items-center p-3 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                Parental Dashboard Guide
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button className="w-full flex justify-between items-center p-3 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                Billing Questions
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
